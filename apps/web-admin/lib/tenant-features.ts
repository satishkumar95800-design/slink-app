'use client';

import { useEffect, useState } from 'react';
import { api } from './api-client';

/** Optional per-school modules from tenants.features (switched on by the platform team). */
export interface TenantFeatures {
  transferCertificate?: boolean;
  feeConcession?: boolean;
}

// Keyed by school so signing in to another school in the same tab refetches.
let cached: { tenantId: string | null; features: Promise<TenantFeatures> } | null = null;

function load(): Promise<TenantFeatures> {
  const tenantId = localStorage.getItem('slink_tenant_id');
  if (cached?.tenantId === tenantId) return cached.features;
  const features = api
    .get<{ features?: TenantFeatures }>('/tenant')
    .then((t) => t.features ?? {})
    .catch(() => {
      cached = null;
      return {};
    });
  cached = { tenantId, features };
  return features;
}

/** Features for the signed-in school; empty (everything off) until loaded. */
export function useTenantFeatures(): TenantFeatures {
  const [features, setFeatures] = useState<TenantFeatures>({});
  useEffect(() => {
    let live = true;
    load().then((f) => live && setFeatures(f));
    return () => {
      live = false;
    };
  }, []);
  return features;
}
