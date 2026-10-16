'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useTenantFeaturesState } from '../lib/tenant-features';
import { EmptyState } from './ui/empty-state';
import { Spinner } from './ui/spinner';

type PlanFeature = 'timetable' | 'staffDocuments' | 'advancedReports';

const MESSAGE: Record<PlanFeature, 'timetableOff' | 'staffDocumentsOff' | 'reportsOff'> = {
  timetable: 'timetableOff',
  staffDocuments: 'staffDocumentsOff',
  advancedReports: 'reportsOff',
};

/** Shows the page only when the school's plan includes `feature` (tenants.features); otherwise says how to get it. */
export function PlanGate({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const t = useTranslations('plans');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  }
  if (features[feature] !== true) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <EmptyState title={t('offTitle')} description={t(MESSAGE[feature])} />
      </div>
    );
  }
  return <>{children}</>;
}
