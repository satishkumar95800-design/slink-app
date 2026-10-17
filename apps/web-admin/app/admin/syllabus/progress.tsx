'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '../../../components/ui/badge';
import type { Progress } from './types';

const BAR = {
  on_time: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  late: 'bg-red-500',
  not_planned: 'bg-gray-300',
} as const;

/** Covered so far, with a thin marker where the plan says it should be by today. */
export function ProgressBar({ p, className = '' }: { p: Progress; className?: string }) {
  const t = useTranslations('syllabus');
  return (
    <div className={className}>
      <div className="relative h-2 w-full rounded-full bg-gray-100" role="img" aria-label={t('progressAria', { percent: p.percent, expected: p.expectedPercent })}>
        <div className={`h-2 rounded-full ${BAR[p.status]}`} style={{ width: `${p.percent}%` }} />
        {p.total > 0 && p.status !== 'completed' && (
          <div
            className="absolute -top-1 h-4 w-0.5 rounded bg-teal"
            style={{ left: `calc(${p.expectedPercent}% - 1px)` }}
            title={t('expectedMarker', { percent: p.expectedPercent })}
          />
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {p.total === 0 ? t('noTopicsYet') : t('coveredOf', { covered: p.covered, total: p.total, percent: p.percent })}
      </p>
    </div>
  );
}

export function StatusBadge({ p }: { p: Progress }) {
  const t = useTranslations('syllabus');
  if (p.status === 'late')
    return <Badge variant="red">{t('statusLate', { days: p.daysLate, count: p.overdue })}</Badge>;
  if (p.status === 'completed') return <Badge variant="green">{t('statusCompleted')}</Badge>;
  if (p.status === 'on_time') return <Badge variant="blue">{t('statusOnTime')}</Badge>;
  return <Badge variant="gray">{t('statusNotPlanned')}</Badge>;
}
