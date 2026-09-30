'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';
import { getSession } from '../../lib/auth';

interface Stats {
  userCount: number;
  studentCount: number;
  feesCollected: number;
  feesOutstanding: number;
  recentPayments: {
    id: string;
    studentName: string;
    amount: number;
    method: string;
    paidOn: string;
  }[];
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

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-3 text-2xl ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function formatCurrency(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

/** Insights' collection-forecast returns rupees directly (SUM over the Decimal receipts.amount column) — no paise division, unlike formatCurrency above. */
function formatRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
function formatMonthLabel(month: string) {
  return MONTH_LABEL_FORMATTER.format(new Date(`${month}-01`));
}

const methodVariant = (method: string): 'green' | 'blue' | 'gray' => {
  const map: Record<string, 'green' | 'blue' | 'gray'> = {
    cash: 'green', gateway: 'blue',
  };
  return map[method] ?? 'gray';
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workload, setWorkload] = useState<TeacherWorkload[]>([]);
  const [forecast, setForecast] = useState<CollectionForecast | null>(null);
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
          api.get<{ id: string; studentName: string; amount: number; method: string; paidOn: string }[]>('/receipts/recent?limit=5'),
          api.get<{ data: { amountDue: number; amountPaid: number; status: string }[] }>('/student-fees?limit=1000'),
        ]);

        const partialStats: Partial<Stats> = {};

        if (usersRes.status === 'fulfilled') partialStats.userCount = usersRes.value.meta.total;
        if (studentsRes.status === 'fulfilled') partialStats.studentCount = studentsRes.value.meta.total;
        if (paymentsRes.status === 'fulfilled') {
          partialStats.recentPayments = paymentsRes.value;
        }
        if (feesRes.status === 'fulfilled') {
          const fees = feesRes.value.data;
          partialStats.feesCollected = fees.reduce((s, f) => s + (f.amountPaid ?? 0), 0);
          partialStats.feesOutstanding = fees.reduce((s, f) => s + Math.max(0, (f.amountDue ?? 0) - (f.amountPaid ?? 0)), 0);
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

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-blue-600" /></div>;
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
            <StatCard label="Total Users" value={stats.userCount ?? '—'} icon="👤" color="bg-blue-50" />
            <StatCard label="Total Students" value={stats.studentCount ?? '—'} icon="🎓" color="bg-purple-50" />
            <StatCard label="Fees Collected" value={stats.feesCollected != null ? formatCurrency(stats.feesCollected) : '—'} icon="✅" color="bg-green-50" />
            <StatCard label="Outstanding Fees" value={stats.feesOutstanding != null ? formatCurrency(stats.feesOutstanding) : '—'} icon="⏳" color="bg-orange-50" />
          </div>

          <div className="rounded-xl bg-white shadow-sm border border-gray-100">
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
                      <p className="text-xs text-gray-500">{new Date(p.paidOn).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-900">{formatRupees(p.amount)}</span>
                      <Badge variant={methodVariant(p.method)}>{p.method}</Badge>
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
          <div className="rounded-xl bg-white shadow-sm border border-gray-100">
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

          <div className="rounded-xl bg-white shadow-sm border border-gray-100">
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

      {isAdmin && workload.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100">
          <div className="border-b px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Teacher Workload</h2>
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
        <div className="rounded-xl bg-white shadow-sm border border-gray-100">
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
              <p className="text-xs text-blue-600">Projected next month</p>
              <p className="mt-1 text-lg font-semibold text-blue-700">
                {formatRupees(forecast.projectedNextMonth)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
