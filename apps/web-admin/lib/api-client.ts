'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

function getAuth(): { token: string | null; tenantId: string | null } {
  if (typeof window === 'undefined') return { token: null, tenantId: null };
  return {
    token: localStorage.getItem('slink_token'),
    tenantId: localStorage.getItem('slink_tenant_id'),
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/** Coalesces concurrent 401s onto a single /auth/refresh call instead of firing one per request. */
let refreshPromise: Promise<string | null> | null = null;

function forceLogout() {
  localStorage.removeItem('slink_token');
  localStorage.removeItem('slink_refresh_token');
  localStorage.removeItem('slink_tenant_id');
  localStorage.removeItem('slink_user');
  document.cookie = 'slink_authed=; path=/; max-age=0';
  window.location.href = '/login';
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('slink_refresh_token');
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;

  const body = await res.json();
  localStorage.setItem('slink_token', body.accessToken);
  localStorage.setItem('slink_refresh_token', body.refreshToken);
  return body.accessToken as string;
}

interface RequestOptions extends RequestInit {
  /** Overrides the logged-in user's own tenant for this call — used by the platform
   * console, where a super_admin acts on a tenant other than the one they belong to. */
  tenantOverride?: string;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { token, tenantId } = getAuth();
  const effectiveTenant = options.tenantOverride ?? tenantId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(effectiveTenant ? { 'X-Tenant-ID': effectiveTenant } : {}),
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401 && !isRetry && typeof window !== 'undefined') {
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (newToken) return apiRequest<T>(path, options, true);
    forceLogout();
    throw new ApiError(401, 'Session expired — please log in again');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: { tenantOverride?: string }) => apiRequest<T>(path, opts),
  post: <T>(path: string, data: unknown, opts?: { tenantOverride?: string }) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(data), ...opts }),
  patch: <T>(path: string, data: unknown, opts?: { tenantOverride?: string }) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(data), ...opts }),
  delete: <T>(path: string, data?: unknown, opts?: { tenantOverride?: string }) =>
    apiRequest<T>(path, {
      method: 'DELETE',
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      ...opts,
    }),
};

/** Multipart upload — omits Content-Type so the browser sets the multipart boundary itself. */
export async function apiUpload<T>(
  path: string,
  file: File,
  fields?: Record<string, string>,
  tenantOverride?: string,
): Promise<T> {
  const { token, tenantId } = getAuth();
  const effectiveTenant = tenantOverride ?? tenantId;
  const formData = new FormData();
  formData.append('file', file);
  if (fields) {
    for (const [key, value] of Object.entries(fields)) formData.append(key, value);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(effectiveTenant ? { 'X-Tenant-ID': effectiveTenant } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const rawMessage =
      (body as { error?: { message?: unknown } })?.error?.message ??
      (body as { message?: unknown })?.message ??
      `HTTP ${res.status}`;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
    throw new ApiError(res.status, message, body);
  }

  return res.json() as Promise<T>;
}

/** Downloads a binary response (e.g. the import template) and triggers a browser save. */
export async function apiDownload(path: string, filename: string, tenantOverride?: string): Promise<void> {
  const { token, tenantId } = getAuth();
  const effectiveTenant = tenantOverride ?? tenantId;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(effectiveTenant ? { 'X-Tenant-ID': effectiveTenant } : {}),
    },
  });

  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
