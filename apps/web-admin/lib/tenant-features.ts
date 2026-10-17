'use client';

import { useEffect, useState } from 'react';
import { api } from './api-client';

/** Optional per-school modules from tenants.features (switched on by the platform team). */
export interface TenantFeatures {
  transferCertificate?: boolean;
  feeConcession?: boolean;
  aiInsights?: boolean;
  pettyCash?: boolean;
  calendar?: boolean;
  hrms?: boolean;
  /** Plan flags (Premium and Gold): on for schools that existed before plans. */
  timetable?: boolean;
  staffDocuments?: boolean;
  advancedReports?: boolean;
  customBranding?: boolean;
  /** Syllabus topics and coverage (Premium and Gold). */
  syllabus?: boolean;
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

/** Features plus whether they have loaded yet (to tell "still loading" from "switched off"). */
export function useTenantFeaturesState(): { features: TenantFeatures; loaded: boolean } {
  const [state, setState] = useState<{ features: TenantFeatures; loaded: boolean }>({ features: {}, loaded: false });
  useEffect(() => {
    let live = true;
    load().then((f) => live && setState({ features: f, loaded: true }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Features for the signed-in school; empty (everything off) until loaded. */
export function useTenantFeatures(): TenantFeatures {
  return useTenantFeaturesState().features;
}
