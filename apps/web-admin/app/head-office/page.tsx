'use client';

import { ArrowDown, ArrowUp, Building2, Download, IndianRupee, Megaphone, Users, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { downloadCsv } from '../../lib/csv';
import { formatRupees } from '../../lib/format';
import { useErrorText } from '../../lib/i18n/errors';
import { Badge } from '../../components/ui/badge';
import { ComplianceCard, Kpi, StatusBadge, UnavailableNote } from './components';
import { EmptyState } from '../../components/ui/empty-state';
import { Spinner } from '../../components/ui/spinner';
import type { Branch, BranchMetrics, Overview } from './types';

/** A comparable measure: how to read it from a branch, and whether higher is better. */
const MEASURES = [
  { key: 'students', get: (m: BranchMetrics) => m.students, better: 'none' },
  { key: 'staff', get: (m: BranchMetrics) => m.staff, better: 'none' },
  { key: 'attToday', get: (m: BranchMetrics) => m.attendanceToday.pct, better: 'high' },
  { key: 'att30', get: (m: BranchMetrics) => m.attendance30, better: 'high' },
  { key: 'collection', get: (m: BranchMetrics) => m.fees.collectionPct, better: 'high' },
  { key: 'outstanding', get: (m: BranchMetrics) => m.fees.outstanding, better: 'low' },
  { key: 'overdue', get: (m: BranchMetrics) => m.fees.overdueCount, better: 'low' },
  { key: 'notices', get: (m: BranchMetrics) => m.noticesLast30, better: 'high' },
  { key: 'appUse', get: (m: BranchMetrics) => m.appUsePct, better: 'high' },
  { key: 'syllabus', get: (m: BranchMetrics) => m.syllabus?.onTimePct ?? null, better: 'high' },
  { key: 'admissions', get: (m: BranchMetrics) => m.admissions?.conversionPct ?? null, better: 'high' },
] as const;
type MeasureKey = (typeof MEASURES)[number]['key'];

/** Group overview: every branch side by side, read-only. */
export default function HeadOfficeOverview() {
  const t = useTranslations('headOffice');
  const errorText = useErrorText();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: MeasureKey | 'name'; dir: 1 | -1 }>({ key: 'name', dir: 1 });

  useEffect(() => {
    api
      .get<Overview>('/head-office/overview')
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [errorText]);

  if (error) return <div className="mx-auto max-w-7xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data)
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (!data.group || !data.totals) return <EmptyState title={t('noGroupTitle')} description={t('noGroup')} />;

  const live = data.branches.filter((b) => b.available && b.metrics);
  // Best and weakest school per measure (only when at least two schools have a value).
  const extremes = new Map<MeasureKey, { best: string; worst: string }>();
  for (const m of MEASURES) {
    if (m.better === 'none') continue;
    const vals = live.map((b) => ({ id: b.id, v: m.get(b.metrics!) })).filter((x): x is { id: string; v: number } => x.v !== null);
    if (vals.length < 2) continue;
    const sorted = [...vals].sort((a, b) => a.v - b.v);
    if (sorted[0].v === sorted[sorted.length - 1].v) continue;
    const [low, high] = [sorted[0].id, sorted[sorted.length - 1].id];
    extremes.set(m.key, m.better === 'high' ? { best: high, worst: low } : { best: low, worst: high });
  }

  const value = (b: Branch, key: MeasureKey | 'name') => {
    if (key === 'name') return b.name;
    const m = MEASURES.find((x) => x.key === key)!;
    return b.metrics ? m.get(b.metrics) : null;
  };
  const rows = [...data.branches].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir;
  });

  const pctText = (v: number | null) => (v === null ? '—' : t('pct', { value: v }));
  const cell = (b: Branch, key: MeasureKey) => {
    const m = b.metrics!;
    switch (key) {
      case 'students':
        return m.students.toLocaleString('en-IN');
      case 'staff':
        return String(m.staff);
      case 'attToday':
        if (m.compliance.state === 'late') return t('lateClasses', { count: m.compliance.notMarked });
        return m.attendanceToday.marked === 0 ? t('notMarked') : pctText(m.attendanceToday.pct);
      case 'att30':
        return pctText(m.attendance30);
      case 'collection':
        return pctText(m.fees.collectionPct);
      case 'outstanding':
        return formatRupees(m.fees.outstanding);
      case 'overdue':
        return String(m.fees.overdueCount);
      case 'notices':
        return String(m.noticesLast30);
      case 'appUse':
        return pctText(m.appUsePct);
      case 'syllabus':
        return m.syllabus ? pctText(m.syllabus.onTimePct) : '—';
      case 'admissions':
        return m.admissions ? t('admissionsCell', { enrolled: m.admissions.enrolled, enquiries: m.admissions.enquiries }) : '—';
    }
  };
  const header = (key: MeasureKey | 'name') => (
    <th key={key} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 uppercase"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'name' ? 1 : -1 }))}
      >
        {t(`col.${key}`)}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  /** The comparison table as a spreadsheet: one row per school, plain numbers. */
  const exportCsv = () => {
    const raw = (b: Branch, key: MeasureKey) => {
      if (!b.metrics) return '';
      if (key === 'admissions') return b.metrics.admissions ? `${b.metrics.admissions.enrolled}/${b.metrics.admissions.enquiries}` : '';
      return MEASURES.find((m) => m.key === key)!.get(b.metrics) ?? '';
    };
    downloadCsv(`${data.group!.name} - schools.csv`, [
      [t('col.name'), ...MEASURES.map((m) => t(`col.${m.key}`))],
      ...rows.map((b) => [b.name, ...MEASURES.map((m) => raw(b, m.key))]),
    ]);
  };

  const tot = data.totals;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{data.group.name}</h1>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </div>

      <ComplianceCard branches={live} cutoff={data.attendanceCutoff ?? '10:00'} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Kpi icon={<Building2 className="h-4 w-4" />} label={t('kpiSchools')} value={String(tot.branches)} sub={t('kpiSchoolsSub', { available: tot.available, total: tot.branches })} />
        <Kpi icon={<Users className="h-4 w-4" />} label={t('kpiStudents')} value={tot.students.toLocaleString('en-IN')} sub={t('kpiStaff', { count: tot.staff })} />
        <Kpi
          icon={<IndianRupee className="h-4 w-4" />}
          label={t('kpiCollected')}
          value={formatRupees(tot.collected)}
          sub={tot.collectionPct === null ? undefined : t('kpiCollectedSub', { pct: tot.collectionPct })}
        />
        <Kpi icon={<Wallet className="h-4 w-4" />} label={t('kpiOutstanding')} value={formatRupees(tot.outstanding)} sub={t('kpiOverdue', { count: tot.overdueCount })} />
        <Kpi
          icon={<Megaphone className="h-4 w-4" />}
          label={t('kpiEnquiries')}
          value={String(tot.enquiries)}
          sub={t('kpiEnrolled', { count: tot.enrolled })}
        />
      </div>

      <section className="rounded-3xl border border-black/5 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t('tableTitle')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('tableHelp')}</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-teal hover:bg-teal/5"
          >
            <Download className="h-4 w-4" />
            {t('exportCsv')}
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {header('name')}
                {MEASURES.map((m) => header(m.key))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((b) => (
                <tr
                  key={b.id}
                  tabIndex={0}
                  onClick={() => router.push(`/head-office/branches/${b.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/head-office/branches/${b.id}`)}
                  className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <td className="whitespace-nowrap px-3 py-3 text-sm">
                    <p className="font-semibold text-gray-900">{b.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <Badge variant="gray">{b.planName}</Badge>
                      <StatusBadge b={b} />
                    </div>
                  </td>
                  {b.available && b.metrics ? (
                    MEASURES.map((m) => {
                      const e = extremes.get(m.key);
                      const late = m.key === 'attToday' && b.metrics!.compliance.state === 'late';
                      const tone = late
                        ? 'bg-red-50 font-semibold text-red-700'
                        : e?.best === b.id
                          ? 'bg-emerald-50 font-semibold text-emerald-800'
                          : e?.worst === b.id
                            ? 'bg-red-50 font-semibold text-red-700'
                            : 'text-gray-700';
                      return (
                        <td key={m.key} className={`whitespace-nowrap px-3 py-3 text-sm ${tone}`}>
                          {cell(b, m.key)}
                        </td>
                      );
                    })
                  ) : (
                    <td colSpan={MEASURES.length} className="px-3 py-3">
                      <UnavailableNote b={b} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
