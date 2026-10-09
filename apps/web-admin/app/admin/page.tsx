'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api-client';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';
import { getSession } from '../../lib/auth';
import { formatDateOnly, formatRupees } from '../../lib/format';
import { strings } from '../../lib/strings';

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

const DAY_LABELS: Record<number, string> = {
  1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

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

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
function formatMonthLabel(month: string) {
  return MONTH_LABEL_FORMATTER.format(new Date(`${month}-01`));
}

type BadgeVariant = 'green' | 'blue' | 'orange' | 'purple' | 'gray';

/** Recent Payments badge: approved claims first (they're stored under their underlying method), then by method. */
function paymentBadge(p: RecentPayment): { label: string; variant: BadgeVariant } {
  if (p.source === 'claim') return { label: strings.paymentMethod.claim, variant: 'purple' };
  switch (p.method) {
    case 'cash':
      return { label: strings.paymentMethod.cash, variant: 'green' };
    case 'cheque':
    case 'demand_draft':
      return { label: strings.paymentMethod.chequeOrDd, variant: 'orange' };
    case 'gateway':
    case 'bank_transfer':
      return { label: strings.paymentMethod.online, variant: 'blue' };
    default:
      return { label: p.method, variant: 'gray' };
  }
}

export default function DashboardPage() {
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
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isTeacher]);

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
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchMyDashboard();
  }, [isTeacher]);

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
  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Failed to load: {error}</div>;

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
            <StatCard label="Total Users" value={stats.userCount ?? '—'} icon="👤" color="bg-teal/5" />
            <StatCard label="Total Students" value={stats.studentCount ?? '—'} icon="🎓" color="bg-purple-50" />
            <StatCard
              label={strings.dashboard.feesCollected}
              value={stats.feesCollected != null ? formatRupees(stats.feesCollected) : '—'}
              subtitle={strings.dashboard.thisAcademicYear(stats.feesAcademicYear ?? null)}
              icon="✅"
              color="bg-green-50"
            />
            <StatCard
              label={strings.dashboard.outstandingFees}
              value={stats.feesOutstanding != null ? formatRupees(stats.feesOutstanding) : '—'}
              subtitle={strings.dashboard.thisAcademicYear(stats.feesAcademicYear ?? null)}
              icon="⏳"
              color="bg-orange-50"
            />
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="border-b px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Payments</h2>
            </div>
            <div className="divide-y">
              {(stats.recentPayments ?? []).length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-gray-500">No payments yet</p>
              ) : (
                stats.recentPayments!.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.studentName}</p>
                      <p className="text-xs text-gray-500">{formatDateOnly(p.paidOn)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{formatRupees(p.amount)}</span>
                      <Badge variant={paymentBadge(p).variant}>{paymentBadge(p).label}</Badge>
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
              <h2 className="text-sm font-semibold text-gray-900">Weekly Routine</h2>
            </div>
            {mySlots.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">No timetable slots assigned yet</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(slotsByDay)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((day) => (
                    <div key={day}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {DAY_LABELS[day]}
                      </p>
                      <ul className="space-y-1.5">
                        {slotsByDay[day].map((slot) => (
                          <li key={slot.id} className="text-sm text-gray-700">
                            <span className="font-medium text-gray-900">Period {slot.periodNumber}</span>
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
              <h2 className="text-sm font-semibold text-gray-900">About My Class(es)</h2>
            </div>
            {myClasses.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">No classes assigned yet</p>
            ) : (
              <div className="divide-y">
                {myClasses.map((mc) => (
                  <div key={mc.class.id} className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      {mc.class.name} {mc.class.section}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Strength: {mc.strength.total} ({mc.strength.male} boys, {mc.strength.female} girls)
                      {mc.strength.other + mc.strength.unspecified > 0
                        ? `, ${mc.strength.other + mc.strength.unspecified} other/unspecified`
                        : ''}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Subjects: {mc.subjects.map((s) => s.name).join(', ') || '—'}
                    </p>
                    {mc.recentReports.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {mc.recentReports.map((r) => (
                          <li key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{r.studentName} — {r.type} report</span>
                            <Badge variant={r.readByAnyParent ? 'green' : 'yellow'}>
                              {r.readByAnyParent ? 'read' : 'unread'}
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
            <h2 className="text-sm font-semibold text-gray-900">{strings.attendance.todayCardTitle}</h2>
            <Link href="/admin/attendance" className="text-xs font-semibold text-teal hover:underline">
              {strings.attendance.pageTitle} →
            </Link>
          </div>
          <div className="px-6 py-4">
            {attendance.holiday ? (
              <p className="text-sm text-gray-600">{strings.attendance.holidayToday(attendance.holiday.name)}</p>
            ) : attendance.daysMarked === 0 ? (
              <p className="text-sm text-gray-600">{strings.attendance.noneMarkedYet}</p>
            ) : (
              <p className="text-2xl font-extrabold text-gray-900">
                {strings.attendance.todaySummary(attendance.daysPresent, attendance.daysMarked, attendance.percentage)}
              </p>
            )}
            {!attendance.holiday && (
              <p className="mt-2 text-xs font-medium text-gray-500">
                {attendance.notMarked.length === 0
                  ? strings.attendance.allMarked
                  : strings.attendance.classesNotMarked(attendance.notMarked.length)}
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
            <h2 className="text-sm font-semibold text-gray-900">Teacher Workload</h2>
            <p className="mt-0.5 text-xs text-gray-500">{strings.workload.note}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  <th className="px-6 py-3">Teacher</th>
                  <th className="px-6 py-3">Classes</th>
                  <th className="px-6 py-3">Subjects</th>
                  <th className="px-6 py-3">Weekly Periods</th>
                  <th className="px-6 py-3">Reports Sent</th>
                  <th className="px-6 py-3">Unread</th>
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
            <h2 className="text-sm font-semibold text-gray-900">Collection Forecast</h2>
            <p className="mt-0.5 text-xs text-gray-500">{forecast.label}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 px-6 py-4 sm:grid-cols-4">
            {forecast.months.map((m) => (
              <div key={m.month}>
                <p className="text-xs text-gray-500">{formatMonthLabel(m.month)}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{formatRupees(m.actual)}</p>
              </div>
            ))}
            <div>
              <p className="text-xs text-teal">Projected next month</p>
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
