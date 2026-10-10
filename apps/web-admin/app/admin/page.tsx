'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';
import { getSession } from '../../lib/auth';
import { useLocale, useTranslations } from 'next-intl';
import { formatDateOnly, formatMonthYear, formatRupees, weekdayName } from '../../lib/format';
import { useErrorText } from '../../lib/i18n/errors';
import { reportTypeLabel } from '../../lib/i18n/labels';

interface Stats {
  userCount: number;
  studentCount: number;
  feesCollected: number;
  feesOutstanding: number;
  feesAcademicYear: string | null;
  recentPayments: RecentPayment[];
}

interface RecentPayment {
  id: string;
  studentName: string;
  amount: number | string;
  method: string;
  source?: 'claim' | 'direct';
  paidOn: string;
}

interface SchoolAttendanceSummary {
  date: string;
  holiday: { name: string } | null;
  totalStudents: number;
  daysMarked: number;
  daysPresent: number;
  percentage: number | null;
  notMarked: { classId: string; name: string; section: string | null }[];
}

interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  classCount: number;
  subjectCount: number;
  weeklyPeriods: number;
  reportsSent: number;
  reportsUnread: number;
}

interface CollectionForecast {
  months: { month: string; actual: number }[];
  projectedNextMonth: number;
  label: string;
}

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  periodNumber: number;
  subject: { id: string; name: string };
  class: { id: string; name: string; section: string };
}

interface MyClass {
  class: { id: string; name: string; section: string };
  strength: { male: number; female: number; other: number; unspecified: number; total: number };
  subjects: { id: string; name: string }[];
  recentReports: {
    id: string;
    type: string;
    term: string | null;
    createdAt: string;
    studentName: string;
    readByAnyParent: boolean;
  }[];
}

function StatCard({ label, value, icon, color, subtitle }: { label: string; value: string | number; icon: string; color: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`rounded-xl p-3 text-2xl ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

type BadgeVariant = 'green' | 'blue' | 'orange' | 'purple' | 'gray';

/** Recent Payments badge: approved claims first (they're stored under their underlying method), then by method. */
function paymentBadge(
  t: ReturnType<typeof useTranslations<'paymentMethod'>>,
  p: RecentPayment,
): { label: string; variant: BadgeVariant } {
  if (p.source === 'claim') return { label: t('claim'), variant: 'purple' };
  switch (p.method) {
    case 'cash':
      return { label: t('cash'), variant: 'green' };
    case 'cheque':
    case 'demand_draft':
      return { label: t('chequeOrDd'), variant: 'orange' };
    case 'gateway':
    case 'bank_transfer':
      return { label: t('online'), variant: 'blue' };
    default:
      return { label: p.method, variant: 'gray' };
  }
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tMethod = useTranslations('paymentMethod');
  const tReport = useTranslations('reportType');
  const locale = useLocale();
  const errorText = useErrorText();
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workload, setWorkload] = useState<TeacherWorkload[]>([]);
  const [forecast, setForecast] = useState<CollectionForecast | null>(null);
  const [attendance, setAttendance] = useState<SchoolAttendanceSummary | null>(null);
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const isTeacher = getSession()?.role === 'teacher';
  const isAdmin = getSession()?.role === 'admin';

  useEffect(() => {
    // Addendum 4 / A10 — fee data (collected/outstanding/recent payments) must
    // never appear on the Teacher Dashboard, even incidentally through this
    // shared component, so teachers skip this fetch entirely.
    if (isTeacher) {
      setLoading(false);
      return;
    }
    async function fetchStats() {
      try {
        const [usersRes, studentsRes, paymentsRes, feesRes] = await Promise.allSettled([
          api.get<{ data: unknown[]; meta: { total: number } }>('/users?limit=1'),
          api.get<{ data: unknown[]; meta: { total: number } }>('/students?limit=1'),
          api.get<RecentPayment[]>('/receipts/recent?limit=5'),
          api.get<{ academicYear: string | null; collected: number; outstanding: number }>('/insights/fee-totals'),
        ]);

        const partialStats: Partial<Stats> = {};

        if (usersRes.status === 'fulfilled') partialStats.userCount = usersRes.value.meta.total;
        if (studentsRes.status === 'fulfilled') partialStats.studentCount = studentsRes.value.meta.total;
        if (paymentsRes.status === 'fulfilled') {
          partialStats.recentPayments = paymentsRes.value;
        }
        if (feesRes.status === 'fulfilled') {
          partialStats.feesCollected = feesRes.value.collected;
          partialStats.feesOutstanding = feesRes.value.outstanding;
          partialStats.feesAcademicYear = feesRes.value.academicYear;
        }

        setStats(partialStats);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isTeacher, errorText]);

  useEffect(() => {
    if (!isTeacher) return;
    async function fetchMyDashboard() {
      try {
        const [slotsRes, classesRes] = await Promise.allSettled([
          api.get<TimetableSlot[]>('/timetable/mine'),
          api.get<MyClass[]>('/teacher-dashboard/my-classes'),
        ]);
        if (slotsRes.status === 'fulfilled') setMySlots(slotsRes.value);
        if (classesRes.status === 'fulfilled') setMyClasses(classesRes.value);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    }
    fetchMyDashboard();
  }, [isTeacher, errorText]);

  useEffect(() => {
    // Addendum 4 / A14 — Teacher Workload is Admin Dashboard only, not accounts/super_admin.
    if (!isAdmin) return;
    async function fetchWorkload() {
      try {
        const data = await api.get<TeacherWorkload[]>('/teacher-dashboard/workload');
        setWorkload([...data].sort((a, b) => b.weeklyPeriods - a.weeklyPeriods));
      } catch {
        // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      }
    }
    fetchWorkload();
  }, [isAdmin]);

  useEffect(() => {
    // Attendance isn't fee data: admin only, not accounts.
    if (!isAdmin) return;
    api
      .get<SchoolAttendanceSummary>('/attendance/school-summary')
      .then(setAttendance)
      .catch(() => {
        // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      });
  }, [isAdmin]);

  useEffect(() => {
    if (isTeacher) return;
    async function fetchForecast() {
      try {
        setForecast(await api.get<CollectionForecast>('/insights/collection-forecast'));
      } catch {
        // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      }
    }
    fetchForecast();
  }, [isTeacher]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-teal" /></div>;
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{tCommon('failedToLoad', { error })}</div>;

  const yearLabel = stats.feesAcademicYear ? t('thisAcademicYearNamed', { year: stats.feesAcademicYear }) : t('thisAcademicYear');

  const slotsByDay = mySlots.reduce<Record<number, TimetableSlot[]>>((acc, slot) => {
    (acc[slot.dayOfWeek] ??= []).push(slot);
    return acc;
  }, {});
  for (const day of Object.keys(slotsByDay)) {
    slotsByDay[Number(day)].sort((a, b) => a.periodNumber - b.periodNumber);
  }

  return (
    <div className="space-y-6">
      {/* Addendum 4 / A10 — no fee-related widget may ever appear on the Teacher
          Dashboard, so the stat cards and Recent Payments below are admin/accounts only. */}
      {!isTeacher && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={t('totalUsers')} value={stats.userCount ?? '—'} icon="👤" color="bg-teal/5" />
            <StatCard label={t('totalStudents')} value={stats.studentCount ?? '—'} icon="🎓" color="bg-purple-50" />
            <StatCard
              label={t('feesCollected')}
              value={stats.feesCollected != null ? formatRupees(stats.feesCollected) : '—'}
              subtitle={yearLabel}
              icon="✅"
              color="bg-green-50"
            />
            <StatCard
              label={t('outstandingFees')}
              value={stats.feesOutstanding != null ? formatRupees(stats.feesOutstanding) : '—'}
              subtitle={yearLabel}
              icon="⏳"
              color="bg-orange-50"
            />
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="border-b px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('recentPayments')}</h2>
            </div>
            <div className="divide-y">
              {(stats.recentPayments ?? []).length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-gray-500">{t('noPayments')}</p>
              ) : (
                stats.recentPayments!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.studentName}</p>
                      <p className="text-xs text-gray-500">{formatDateOnly(p.paidOn)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{formatRupees(p.amount)}</span>
                      <Badge variant={paymentBadge(tMethod, p).variant}>{paymentBadge(tMethod, p).label}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {isTeacher && (
        <>
          <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="border-b px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('weeklyRoutine')}</h2>
            </div>
            {mySlots.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">{t('noSlots')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(slotsByDay)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((day) => (
                    <div key={day}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {weekdayName(day, locale)}
                      </p>
                      <ul className="space-y-1.5">
                        {slotsByDay[day].map((slot) => (
                          <li key={slot.id} className="text-sm text-gray-700">
                            <span className="font-medium text-gray-900">{t('period', { n: slot.periodNumber })}</span>
                            {' — '}
                            {slot.subject.name} ({slot.class.name} {slot.class.section})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="border-b px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('aboutMyClasses')}</h2>
            </div>
            {myClasses.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">{t('noClasses')}</p>
            ) : (
              <div className="divide-y">
                {myClasses.map((mc) => (
                  <div key={mc.class.id} className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {mc.class.name} {mc.class.section}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('strength', { total: mc.strength.total, boys: mc.strength.male, girls: mc.strength.female })}
                      {mc.strength.other + mc.strength.unspecified > 0
                        ? t('strengthOther', { count: mc.strength.other + mc.strength.unspecified })
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('subjects', { list: mc.subjects.map((s) => s.name).join(', ') || '—' })}
                    </p>
                    {mc.recentReports.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {mc.recentReports.map((r) => (
                          <li key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{t('reportLine', { student: r.studentName, type: reportTypeLabel(tReport, r.type) })}</span>
                            <Badge variant={r.readByAnyParent ? 'green' : 'yellow'}>
                              {r.readByAnyParent ? t('read') : t('unread')}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isAdmin && attendance && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('todayAttendance')}</h2>
            <Link href="/admin/attendance" className="text-xs font-semibold text-teal hover:underline">
              {t('attendanceLink')} →
            </Link>
          </div>
          <div className="px-6 py-4">
            {attendance.holiday ? (
              <p className="text-sm text-gray-600">{t('holidayToday', { name: attendance.holiday.name })}</p>
            ) : attendance.daysMarked === 0 ? (
              <p className="text-sm text-gray-600">{t('noneMarkedYet')}</p>
            ) : (
              <p className="text-2xl font-extrabold text-gray-900">
                {attendance.percentage != null
                  ? t('todaySummaryPct', { present: attendance.daysPresent, total: attendance.daysMarked, pct: attendance.percentage })
                  : t('todaySummary', { present: attendance.daysPresent, total: attendance.daysMarked })}
              </p>
            )}
            {!attendance.holiday && (
              <p className="mt-2 text-xs font-medium text-gray-500">
                {attendance.notMarked.length === 0
                  ? t('allMarked')
                  : t('classesNotMarked', { count: attendance.notMarked.length })}
              </p>
            )}
            {!attendance.holiday && attendance.notMarked.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attendance.notMarked.map((c) => (
                  <Badge key={c.classId} variant="orange">
                    {[c.name, c.section].filter(Boolean).join(' ')}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && workload.length > 0 && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
          <div className="border-b px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('teacherWorkload')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{t('workloadNote')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="px-6 py-3">{t('colTeacher')}</th>
                  <th className="px-6 py-3">{t('colClasses')}</th>
                  <th className="px-6 py-3">{t('colSubjects')}</th>
                  <th className="px-6 py-3">{t('colWeeklyPeriods')}</th>
                  <th className="px-6 py-3">{t('colReportsSent')}</th>
                  <th className="px-6 py-3">{t('colUnread')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {workload.map((t) => (
                  <tr key={t.teacherId}>
                    <td className="px-6 py-3 font-medium text-gray-900">{t.teacherName}</td>
                    <td className="px-6 py-3 text-gray-500">{t.classCount}</td>
                    <td className="px-6 py-3 text-gray-500">{t.subjectCount}</td>
                    <td className="px-6 py-3 text-gray-900 font-semibold">{t.weeklyPeriods}</td>
                    <td className="px-6 py-3 text-gray-500">{t.reportsSent}</td>
                    <td className="px-6 py-3 text-gray-500">{t.reportsUnread}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isTeacher && forecast && (
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
          <div className="border-b px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('collectionForecast')}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{forecast.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-4">
            {forecast.months.map((m) => (
              <div key={m.month}>
                <p className="text-xs text-gray-500">{formatMonthYear(m.month, locale)}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{formatRupees(m.actual)}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-teal">{t('projectedNextMonth')}</p>
              <p className="mt-1 text-lg font-semibold text-teal">
                {formatRupees(forecast.projectedNextMonth)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
