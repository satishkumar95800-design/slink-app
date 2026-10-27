'use client';

import { AlarmClock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
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
  const variant = b.status === 'trial' ? 'blue' : b.status === 'renewal_due' ? 'yellow' : b.status === 'grace' ? 'orange' : 'red';
  return <Badge variant={variant}>{t(`status.${b.status}`)}</Badge>;
}


/** Branches that haven't marked attendance by the group's cutoff (docs/SPEC-franchise.md §2). */
export function ComplianceCard({ branches, cutoff }: { branches: Branch[]; cutoff: string }) {
  const t = useTranslations('headOffice');
  const late = branches.filter((b) => b.metrics?.compliance.state === 'late');
  const pending = branches.filter((b) => b.metrics?.compliance.state === 'pending');
  if (late.length === 0)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {pending.length > 0 ? t('compliancePending', { count: pending.length, cutoff }) : t('complianceOk')}
      </p>
    );
  return (
    <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="flex items-center gap-2 font-semibold">
        <AlarmClock className="h-4 w-4 shrink-0" />
        {t('complianceLate', { count: late.length, cutoff })}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {late.map((b) => (
          <li key={b.id}>
            <Link href={`/head-office/branches/${b.id}`} className="inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:underline">
              {t('complianceBranch', { name: b.name, count: b.metrics!.compliance.notMarked })}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
