'use client';

import { BookOpenCheck, CalendarCheck, IndianRupee, Smartphone, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api-client';
import { formatDateOnly, formatMonthYear, formatRupees } from '../../../../lib/format';
import { useErrorText } from '../../../../lib/i18n/errors';
import { Badge } from '../../../../components/ui/badge';
import { Spinner } from '../../../../components/ui/spinner';
import { TrendChart } from '../../../admin/dashboard-charts';
import { Kpi, StatusBadge, UnavailableNote } from '../../components';
import type { BranchDetail } from '../../types';

/** One school of the group in more detail. Read-only. */
export default function BranchPage() {
  const t = useTranslations('headOffice');
  const locale = useLocale();
  const errorText = useErrorText();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BranchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<BranchDetail>(`/head-office/branches/${id}`)
      .then(setData)
      .catch((e) => setError(errorText(e)));
  }, [id, errorText]);

  const back = (
    <Link href="/head-office" className="text-sm text-gray-500 hover:text-gray-700">
      ← {t('back')}
    </Link>
  );
  if (error)
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        {back}
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  if (!data)
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const pctText = (v: number | null) => (v === null ? '—' : t('pct', { value: v }));
  const m = data.metrics;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        {back}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{data.name}</h1>
          <Badge variant="gray">{data.planName}</Badge>
          <StatusBadge b={data} />
        </div>
      </div>

      {!data.available || !m ? (
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <UnavailableNote b={data} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <Kpi icon={<Users className="h-4 w-4" />} label={t('kpiStudents')} value={m.students.toLocaleString('en-IN')} sub={t('kpiStaff', { count: m.staff })} />
            <Kpi
              icon={<CalendarCheck className="h-4 w-4" />}
              label={t('col.att30')}
              value={pctText(m.attendance30)}
              sub={m.attendanceToday.marked === 0 ? t('todayNotMarked') : t('todayPct', { value: m.attendanceToday.pct ?? 0 })}
            />
            <Kpi
              icon={<IndianRupee className="h-4 w-4" />}
              label={t('kpiCollected')}
              value={formatRupees(m.fees.collected)}
              sub={m.fees.collectionPct === null ? undefined : t('kpiCollectedSub', { pct: m.fees.collectionPct })}
            />
            <Kpi icon={<Wallet className="h-4 w-4" />} label={t('kpiOutstanding')} value={formatRupees(m.fees.outstanding)} sub={t('kpiOverdue', { count: m.fees.overdueCount })} />
            <Kpi icon={<Smartphone className="h-4 w-4" />} label={t('col.appUse')} value={pctText(m.appUsePct)} sub={t('appUseSub')} />
            <Kpi
              icon={<BookOpenCheck className="h-4 w-4" />}
              label={t('col.syllabus')}
              value={m.syllabus ? pctText(m.syllabus.onTimePct) : '—'}
              sub={m.syllabus ? t('syllabusSub', { onTime: m.syllabus.onTime, planned: m.syllabus.planned }) : t('syllabusOff')}
            />
          </div>

          {m.compliance.state === 'late' && (
            <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              {t('complianceBranchLate', { count: m.compliance.notMarked, total: m.compliance.classes })}
            </p>
          )}

          {m.admissions && (
            <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900">{t('admissionsTitle')}</h2>
                <p className="text-sm text-gray-600">{t('admissionsConversion', { pct: m.admissions.conversionPct ?? 0, lost: m.admissions.lost })}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t('funnelEnquiries'), m.admissions.enquiries],
                  [t('funnelTours'), m.admissions.tours],
                  [t('funnelRegistrations'), m.admissions.registrations],
                  [t('funnelEnrolled'), m.admissions.enrolled],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-cream/70 p-3">
                    <p className="text-2xl font-extrabold text-gray-900">{value}</p>
                    <p className="text-xs font-semibold text-gray-600">{label}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{t('monthlyTitle')}</h2>
              {data.monthlyCollection.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">{t('noData')}</p>
              ) : (
                <div className="mt-4">
                  <TrendChart
                    height="h-48"
                    bars={data.monthlyCollection.map((x) => ({ key: x.month, label: formatMonthYear(x.month, locale), amount: x.amount }))}
                  />
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{t('trendTitle')}</h2>
              {data.attendanceTrend.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">{t('noData')}</p>
              ) : (
                <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label={t('trendTitle')}>
                  {data.attendanceTrend.map((d) => (
                    <div
                      key={d.date}
                      title={t('trendDay', { date: formatDateOnly(d.date), value: d.pct ?? 0 })}
                      className={`flex-1 rounded-t ${d.pct !== null && d.pct < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                      style={{ height: `${Math.max(4, d.pct ?? 0)}%` }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-black/5 bg-white shadow-sm">
            <h2 className="px-5 pt-5 text-base font-semibold text-gray-900">{t('classesTitle')}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cream/60">
                  <tr>
                    {[t('col.class'), t('col.students'), t('col.att30'), t('col.collection'), t('amountCollected'), t('col.outstanding')].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.classes.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{c.students}</td>
                      <td className={`px-4 py-2.5 text-sm ${c.attendance30 !== null && c.attendance30 < 80 ? 'font-semibold text-amber-700' : 'text-gray-700'}`}>{pctText(c.attendance30)}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-700">{pctText(c.collectionPct)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700">{formatRupees(c.collected)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-gray-900">{formatRupees(c.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
