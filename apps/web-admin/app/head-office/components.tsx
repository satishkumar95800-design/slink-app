'use client';

import { useTranslations } from 'next-intl';
import { ReactNode } from 'react';
import { Badge } from '../../components/ui/badge';
import type { Branch } from './types';

export function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-gray-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal/10 text-teal">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/** Why a branch shows no numbers: not in its plan, or switched off. */
export function UnavailableNote({ b }: { b: Branch }) {
  const t = useTranslations('headOffice');
  return <span className="text-xs text-gray-500">{!b.included ? t('notIncluded', { plan: b.planName }) : t('switchedOff')}</span>;
}

export function StatusBadge({ b }: { b: Branch }) {
  const t = useTranslations('headOffice');
  if (b.status === 'active') return null;
  const variant = b.status === 'renewal_due' ? 'yellow' : b.status === 'grace' ? 'orange' : 'red';
  return <Badge variant={variant}>{t(`status.${b.status}`)}</Badge>;
}

