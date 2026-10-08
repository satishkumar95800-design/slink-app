'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { formatRupees } from '../../../lib/format';

type PaymentStatus = 'created' | 'attempted' | 'paid' | 'failed' | 'refunded';

interface Payment {
  id: string;
  gateway: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  studentFee?: {
    student?: { name: string; admissionNo: string };
    feeStructure?: { name: string };
  };
  transactions?: { paidAt: string; gatewayPaymentId: string }[];
}

const statusVariant = (s: PaymentStatus): 'green' | 'red' | 'yellow' | 'blue' | 'gray' => {
  const m: Record<PaymentStatus, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
    paid: 'green',
    failed: 'red',
    created: 'gray',
    attempted: 'yellow',
    refunded: 'blue',
  };
  return m[s];
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function fetchPayments(status?: string) {
    try {
      setLoading(true);
      const qs = status ? `?status=${status}&limit=100` : '?limit=100';
      const res = await api.get<{ data: Payment[]; total: number }>(`/payments/orders${qs}`);
      setPayments(res.data);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayments();
  }, []);

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'created', label: 'Created' },
    { value: 'attempted', label: 'Attempted' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-coral focus:ring-1 focus:ring-coral outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              fetchPayments(e.target.value || undefined);
            }}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">{total} payment{total !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : payments.length === 0 ? (
        <EmptyState
          title="No payments"
          description="Payment orders will appear here as parents initiate them."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {['Student', 'Fee', 'Gateway Order', 'Amount', 'Gateway', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {p.studentFee?.student?.name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.studentFee?.student?.admissionNo ?? ''}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {p.studentFee?.feeStructure?.name ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-gray-500">{p.gatewayOrderId}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatRupees(p.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="gray">{p.gateway}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(p.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
