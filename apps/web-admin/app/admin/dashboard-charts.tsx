'use client';

import { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatRupees, toAmount } from '../../lib/format';

/** Dashboard charts, drawn with plain SVG/CSS so the console needs no chart library. */

/** White card holding one chart; the corner arrow opens the section's full view. */
export function ChartCard({
  title,
  subtitle,
  icon,
  accent,
  onOpen,
  className = '',
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Tailwind classes for the icon square. */
  accent: string;
  onOpen?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations('dashboard');
  return (
    <div className={`flex flex-col rounded-3xl border border-black/5 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${accent}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-gray-500">{subtitle}</p>}
        </div>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={t('openDetails', { title })}
            title={t('openDetails', { title })}
            className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/[0.03] text-gray-400 transition-colors hover:bg-teal hover:text-white"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

/** Ring showing one share out of 100, with a label in the middle. */
export function Ring({
  pct,
  center,
  trackClass,
  barClass,
  size = 'h-36 w-36',
}: {
  pct: number;
  center: ReactNode;
  trackClass: string;
  barClass: string;
  size?: string;
}) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className={`relative flex-shrink-0 ${size}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="12" className={trackClass} />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          className={`${barClass} transition-[stroke-dashoffset] duration-700`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`h-3 w-3 flex-shrink-0 rounded-full ${color}`} />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/** Collected vs outstanding for the year. */
export function FeeDonut({ collected, outstanding }: { collected: number; outstanding: number }) {
  const t = useTranslations('dashboard');
  const total = toAmount(collected) + toAmount(outstanding);
  const pct = total > 0 ? Math.round((toAmount(collected) / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <Ring
        pct={pct}
        trackClass="stroke-amber-100"
        barClass="stroke-emerald-500"
        center={
          <>
            <span className="text-2xl font-extrabold text-gray-900">{t('attendancePct', { pct })}</span>
            <span className="text-[11px] font-medium text-gray-500">{t('collectedShort')}</span>
          </>
        }
      />
      <div className="grid w-full gap-3">
        <Legend color="bg-emerald-500" label={t('feesCollected')} value={formatRupees(collected)} />
        <Legend color="bg-amber-200" label={t('outstandingFees')} value={formatRupees(outstanding)} />
        <Legend color="bg-gray-200" label={t('totalDue')} value={formatRupees(total)} />
      </div>
    </div>
  );
}

/** Monthly bars, the last one dashed for the projection. */
export function TrendChart({
  bars,
  height = 'h-56',
}: {
  bars: { key: string; label: string; amount: number | string; projected?: boolean }[];
  height?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => toAmount(b.amount)));
  return (
    <div className={`flex items-end gap-3 ${height}`}>
      {bars.map((b) => (
        <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <span className={`whitespace-nowrap text-[11px] font-semibold ${b.projected ? 'text-coral' : 'text-gray-700'}`}>
            {formatRupees(b.amount)}
          </span>
          <div className="flex w-full flex-1 items-end justify-center">
            <div
              className={`w-full max-w-[56px] rounded-t-xl transition-all duration-700 ${
                b.projected ? 'border-2 border-dashed border-coral bg-coral/15' : 'bg-gradient-to-t from-teal to-teal-light'
              }`}
              style={{ height: `${Math.max(4, (toAmount(b.amount) / max) * 100)}%` }}
            />
          </div>
          <span className={`whitespace-nowrap text-xs ${b.projected ? 'font-semibold text-coral' : 'text-gray-500'}`}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Present / absent / not yet marked, as one stacked bar. */
export function AttendanceSplit({
  present,
  marked,
  total,
}: {
  present: number;
  marked: number;
  total: number;
}) {
  const t = useTranslations('dashboard');
  const absent = Math.max(0, marked - present);
  const unmarked = Math.max(0, total - marked);
  const whole = Math.max(1, present + absent + unmarked);
  const parts = [
    { key: 'present', n: present, bar: 'bg-emerald-500', label: t('legendPresent') },
    { key: 'absent', n: absent, bar: 'bg-rose-400', label: t('legendAbsent') },
    { key: 'unmarked', n: unmarked, bar: 'bg-gray-200', label: t('legendNotMarked') },
  ];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {parts.map((p) => (
          <div key={p.key} className={`${p.bar} transition-all duration-700`} style={{ width: `${(p.n / whole) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {parts.map((p) => (
          <div key={p.key} className="flex items-center gap-2 text-xs text-gray-600">
            <span className={`h-2.5 w-2.5 rounded-full ${p.bar}`} />
            <span>{p.label}</span>
            <span className="font-bold text-gray-900">{p.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars, longest first. */
export function HBarChart({
  rows,
  barClass,
  trackClass,
  limit = 8,
  formatValue = String,
}: {
  rows: { key: string; label: string; value: number }[];
  barClass: string;
  trackClass: string;
  limit?: number;
  formatValue?: (v: number) => string;
}) {
  const shown = rows.slice(0, limit);
  const max = Math.max(1, ...shown.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {shown.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate font-medium text-gray-700">{r.label}</span>
          <div className={`h-2.5 overflow-hidden rounded-full ${trackClass}`}>
            <div className={`h-full rounded-full ${barClass} transition-all duration-700`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="min-w-8 text-right font-bold text-gray-900">{formatValue(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}
