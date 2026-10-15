'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, Info, RefreshCw, Sparkles, X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { formatDateOnly, formatRupees, weekdayName } from '../../lib/format';
import { useToast } from '../../components/ui/toast';

export interface AlertReason {
  key: string;
  params?: Record<string, string | number>;
}

export interface InsightAlert {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  subjectType: string;
  subjectId: string | null;
  subjectName: string | null;
  reasons: AlertReason[];
  updatedAt: string;
}

const KINDS = [
  'absence_streak',
  'weekday_absence',
  'attendance_drop',
  'siblings_absent',
  'class_not_marked',
  'parent_disengaged',
  'student_at_risk',
  'fee_late_risk',
  'duplicate_reference',
  'odd_hour_receipts',
  'concession_concentration',
  'teacher_overload',
] as const;

const REASONS = [
  'absent_days_in_a_row',
  'absent_on_weekday',
  'attendance_fell',
  'siblings_absent_together',
  'attendance_not_marked',
  'parent_stopped_reading',
  'low_attendance',
  'complaints',
  'paid_late_before',
  'has_overdue',
  'due_soon',
  'reference_on_receipts',
  'receipts_late_at_night',
  'concessions_by_one_person',
  'periods_vs_average',
  'summary_attendance',
  'summary_attendance_change',
  'summary_collected',
  'summary_overdue',
  'summary_expected',
  'summary_alerts',
  'summary_not_marked',
] as const;

type Kind = (typeof KINDS)[number];
type ReasonKey = (typeof REASONS)[number];
const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);
const isReason = (k: string): k is ReasonKey => (REASONS as readonly string[]).includes(k);

const SEVERITY_STYLE = {
  critical: { chip: 'bg-red-100 text-red-700', icon: AlertTriangle },
  warning: { chip: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  info: { chip: 'bg-sky-100 text-sky-700', icon: Info },
} as const;

/** Formats money, dates and weekdays inside reason params before translating. */
function useReasonText() {
  const t = useTranslations('alerts');
  const locale = useLocale();
  return useCallback(
    (r: AlertReason): string | null => {
      if (!isReason(r.key)) return null;
      const p = { ...(r.params ?? {}) };
      for (const k of ['amount', 'expected', 'due'] as const) {
        if (k in p) p[k] = formatRupees(Number(p[k]));
      }
      if (typeof p.date === 'string') p.date = formatDateOnly(p.date);
      if ('weekday' in p) p.weekday = weekdayName(Number(p.weekday), locale);
      if ('change' in p) p.change = `${Number(p.change) > 0 ? '+' : ''}${p.change}`;
      return t(`reason_${r.key}`, p as Record<string, string | number>);
    },
    [t, locale],
  );
}

/** Open alerts for the signed-in user; null while loading or without the module. */
export function useAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<InsightAlert[] | null>(null);
  const reload = useCallback(() => {
    api
      .get<InsightAlert[]>('/alerts')
      .then(setAlerts)
      .catch(() => setAlerts(null));
  }, []);
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);
  return { alerts: enabled ? alerts : null, setAlerts, reload };
}

/** "3 things need attention" strip under the dashboard header. */
export function AlertsBanner({
  alerts,
  hasSummary,
  onOpen,
}: {
  alerts: InsightAlert[];
  /** Admins: show the banner for the weekly summary even with no alerts. */
  hasSummary?: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations('alerts');
  if (alerts.length === 0 && !hasSummary) return null;
  const critical = alerts.filter((a) => a.severity === 'critical').length;
  const warning = alerts.filter((a) => a.severity === 'warning').length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full cursor-pointer items-center gap-4 rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-4 text-left shadow-sm transition hover:shadow-md sm:px-5"
    >
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-gray-900">
          {alerts.length > 0 ? t('bannerTitle', { count: alerts.length }) : t('summaryReady')}
        </span>
        {alerts.length > 0 && (
          <span className="block text-xs text-gray-600">
            {t('bannerCounts', { critical, warning, info: alerts.length - critical - warning })}
          </span>
        )}
      </span>
      <span className="rounded-full bg-violet-600 px-4 py-1.5 text-xs font-bold text-white transition-colors group-hover:bg-violet-700">
        {t('review')}
      </span>
    </button>
  );
}

/** Weekly numbers for admins (docs/SPEC-ai.md 1.4). */
export function WeeklySummary({ summary }: { summary: { reasons: AlertReason[]; createdAt: string } }) {
  const t = useTranslations('alerts');
  const text = useReasonText();
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <BellRing className="h-4 w-4 text-violet-600" />
        {t('summaryTitle', { date: formatDateOnly(summary.createdAt) })}
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
        {summary.reasons.map((r, i) => {
          const line = text(r);
          return line ? <li key={i}>{line}</li> : null;
        })}
      </ul>
    </div>
  );
}

/** Full list with reasons and dismiss; admins can recompute now. */
export function AlertsList({
  alerts,
  onChange,
  canRun,
  summary,
}: {
  alerts: InsightAlert[];
  onChange: (alerts: InsightAlert[]) => void;
  canRun?: boolean;
  summary?: { reasons: AlertReason[]; createdAt: string } | null;
}) {
  const t = useTranslations('alerts');
  const text = useReasonText();
  const errorText = useErrorText();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const kindCounts = [...alerts.reduce((m, a) => m.set(a.kind, (m.get(a.kind) ?? 0) + 1), new Map<string, number>())];
  const shown = kind ? alerts.filter((a) => a.kind === kind) : alerts;

  async function dismiss(id: string) {
    try {
      await api.post(`/alerts/${id}/dismiss`, {});
      onChange(alerts.filter((a) => a.id !== id));
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      await api.post('/alerts/run', {});
      onChange(await api.get<InsightAlert[]>('/alerts'));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      {summary && <WeeklySummary summary={summary} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{t('explainer')}</p>
        {canRun && (
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:border-violet-400 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            {t('runNow')}
          </button>
        )}
      </div>
      {kindCounts.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {[null, ...kindCounts.map(([k]) => k)].map((k) => {
            const on = kind === k;
            const count = k ? (kindCounts.find(([x]) => x === k)?.[1] ?? 0) : alerts.length;
            return (
              <button
                key={k ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k)}
                className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  on ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-violet-400'
                }`}
              >
                {k ? (isKind(k) ? t(`kind_${k}`) : k) : t('all')} ({count})
              </button>
            );
          })}
        </div>
      )}
      {alerts.length === 0 ? (
        <p className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-gray-500 shadow-sm">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const style = SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.info;
            const Icon = style.icon;
            const subjectLink =
              a.subjectType === 'student' && a.subjectId ? `/admin/students/${a.subjectId}` : null;
            return (
              <li key={a.id} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">
                      {isKind(a.kind) ? t(`kind_${a.kind}`) : a.kind}
                      {a.subjectName && (
                        <>
                          {' · '}
                          {subjectLink ? (
                            <Link href={subjectLink} className="text-teal hover:underline">
                              {a.subjectName}
                            </Link>
                          ) : (
                            <span className="font-semibold text-gray-700">{a.subjectName}</span>
                          )}
                        </>
                      )}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                      {a.reasons.map((r, i) => {
                        const line = text(r);
                        return line ? <li key={i}>{line}</li> : null;
                      })}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(a.id)}
                    title={t('dismiss')}
                    aria-label={t('dismiss')}
                    className="flex-shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
