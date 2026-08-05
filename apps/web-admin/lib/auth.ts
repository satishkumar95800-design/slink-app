'use client';

import type { Role } from '@slink/types';

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  tenantId: string;
}

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('slink_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('slink_token');
}

export function setSession(
  user: SessionUser,
  accessToken: string,
  refreshToken: string,
) {
  localStorage.setItem('slink_token', accessToken);
  localStorage.setItem('slink_refresh_token', refreshToken);
  localStorage.setItem('slink_tenant_id', user.tenantId);
  localStorage.setItem('slink_user', JSON.stringify(user));
  // Also set a plain cookie so middleware can check auth
  document.cookie = `slink_authed=1; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
}

export function clearSession() {
  localStorage.removeItem('slink_token');
  localStorage.removeItem('slink_refresh_token');
  localStorage.removeItem('slink_tenant_id');
  localStorage.removeItem('slink_user');
  document.cookie = 'slink_authed=; path=/; max-age=0';
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
