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
    /** API error code (e.g. INVALID_CREDENTIALS) or NETWORK_ERROR / SESSION_EXPIRED; translated by lib/i18n/errors.ts. */
    public code?: string,
  ) {
    super(message);
  }
}

function errorCode(body: unknown): string | undefined {
  const code = (body as { error?: { code?: unknown } })?.error?.code;
  return typeof code === 'string' ? code : undefined;
}

/** fetch() itself failed (offline, DNS, CORS) — surfaced as a translatable ApiError. */
async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.', undefined, 'NETWORK_ERROR');
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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Could not reach the server: the refresh token may still be good, so the session is kept.
    throw new ApiError(0, 'Network error — check your connection and try again.', undefined, 'NETWORK_ERROR');
  }
  // Only the server refusing the refresh token ends the session; any other failure is transient.
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`, undefined, 'NETWORK_ERROR');

  const body = await res.json();
  localStorage.setItem('slink_token', body.accessToken);
  localStorage.setItem('slink_refresh_token', body.refreshToken);
  return body.accessToken as string;
}

/** One refresh at a time, shared by 401 retries and the proactive check. Null = session really over. */
function refreshSession(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

const REFRESH_AHEAD_MS = 60_000;

/** Reads the `exp` claim of the access JWT. Not a security check — the server verifies every call. */
function accessTokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Keeps the console session honest without waiting for a click: refreshes the access token shortly
 * before it expires, and logs out as soon as the server refuses the refresh token. Cheap to call often;
 * it only talks to the server near expiry. A network failure keeps the session and is retried later.
 */
export async function keepSessionAlive(): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('slink_token');
  if (!token) {
    forceLogout();
    return;
  }
  const expiresAt = accessTokenExpiresAt(token);
  if (expiresAt === null || expiresAt - Date.now() > REFRESH_AHEAD_MS) return;
  try {
    const newToken = await refreshSession();
    if (!newToken) forceLogout();
  } catch {
    // Offline or server hiccup: try again on the next check.
  }
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

  const res = await send(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(effectiveTenant ? { 'X-Tenant-ID': effectiveTenant } : {}),
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    if (!isRetry) {
      const newToken = await refreshSession();
      if (newToken) return apiRequest<T>(path, options, true);
    }
    // Either the refresh was refused, or the fresh token was refused too: the session is over.
    forceLogout();
    throw new ApiError(401, 'Session expired — please log in again', undefined, 'SESSION_EXPIRED');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message, body, errorCode(body));
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
  put: <T>(path: string, data: unknown, opts?: { tenantOverride?: string }) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(data), ...opts }),
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

  const res = await send(`${API_BASE}${path}`, {
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
    throw new ApiError(res.status, message, body, errorCode(body));
  }

  return res.json() as Promise<T>;
}

/** Downloads a binary response (e.g. the import template) and triggers a browser save. */
export async function apiDownload(path: string, filename: string, tenantOverride?: string): Promise<void> {
  const { token, tenantId } = getAuth();
  const effectiveTenant = tenantOverride ?? tenantId;

  const res = await send(`${API_BASE}${path}`, {
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
