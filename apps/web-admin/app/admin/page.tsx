'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { Spinner } from '../../components/ui/spinner';
import { Badge } from '../../components/ui/badge';

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

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, studentsRes, paymentsRes, feesRes] = await Promise.allSettled([
          api.get<{ data: unknown[]; total: number }>('/users?limit=1'),
          api.get<{ data: unknown[]; total: number }>('/students?limit=1'),
          api.get<{ data: { id: string; amount: number; status: string; createdAt: string; studentFee?: { student?: { name: string } } }[]; total: number }>('/payments?limit=5'),
          api.get<{ data: { amountDue: number; amountPaid: number; status: string }[] }>('/fees/student-fees?limit=1000'),
        ]);

        const partialStats: Partial<Stats> = {};

        if (usersRes.status === 'fulfilled') partialStats.userCount = usersRes.value.total;
        if (studentsRes.status === 'fulfilled') partialStats.studentCount = studentsRes.value.total;
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
    </div>
  );
}
