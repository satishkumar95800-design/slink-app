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
    amount: number;
    status: string;
    createdAt: string;
    student?: { name: string };
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

const statusVariant = (status: string): 'green' | 'red' | 'yellow' | 'gray' => {
  const map: Record<string, 'green' | 'red' | 'yellow' | 'gray'> = {
    paid: 'green', pending: 'yellow', partial: 'gray', overdue: 'red',
  };
  return map[status] ?? 'gray';
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workload, setWorkload] = useState<TeacherWorkload[]>([]);
  const [forecast, setForecast] = useState<CollectionForecast | null>(null);
  const isTeacher = getSession()?.role === 'teacher';

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, studentsRes, paymentsRes, feesRes] = await Promise.allSettled([
          api.get<{ data: unknown[]; meta: { total: number } }>('/users?limit=1'),
          api.get<{ data: unknown[]; meta: { total: number } }>('/students?limit=1'),
          api.get<{ data: { id: string; amount: number; status: string; createdAt: string; studentFee?: { student?: { name: string } } }[]; total: number }>('/payments/orders?limit=5'),
          api.get<{ data: { amountDue: number; amountPaid: number; status: string }[] }>('/student-fees?limit=1000'),
        ]);

        const partialStats: Partial<Stats> = {};

        if (usersRes.status === 'fulfilled') partialStats.userCount = usersRes.value.meta.total;
        if (studentsRes.status === 'fulfilled') partialStats.studentCount = studentsRes.value.meta.total;
        if (paymentsRes.status === 'fulfilled') {
          partialStats.recentPayments = paymentsRes.value.data.map((p) => ({
            id: p.id, amount: p.amount, status: p.status, createdAt: p.createdAt,
            student: p.studentFee?.student,
          }));
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
  }, []);

  useEffect(() => {
    if (isTeacher) return;
    async function fetchWorkload() {
      try {
        const data = await api.get<TeacherWorkload[]>('/teacher-dashboard/workload');
        setWorkload([...data].sort((a, b) => b.weeklyPeriods - a.weeklyPeriods));
      } catch {
        // Non-critical widget — fail silently, keep the rest of the dashboard usable.
      }
    }
    fetchWorkload();
  }, [isTeacher]);

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

  return (
    <div className="space-y-6">
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
                  <p className="text-sm font-medium text-gray-900">{p.student?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</span>
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {!isTeacher && workload.length > 0 && (
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
