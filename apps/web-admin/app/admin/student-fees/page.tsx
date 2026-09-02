'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

type FeeStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'waived';

interface StudentFee {
  id: string;
  amountDue: number;
  amountPaid: number;
  status: FeeStatus;
  dueDate: string;
  student?: { name: string; admissionNo: string };
  feeStructure?: { name: string };
}

interface Student {
  id: string;
  name: string;
  admissionNo: string;
}

interface FeeStructure {
  id: string;
  name: string;
  totalAmount: number;
}

const assignSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  feeStructureId: z.string().min(1, 'Fee structure is required'),
});

const offlineSchema = z.object({
  studentFeeId: z.string().min(1),
  amount: z.number().min(0.01, 'Amount required'),
  method: z.enum(['cash', 'cheque', 'bank_transfer', 'demand_draft']),
  reference: z.string().optional(),
  paidOn: z.string().optional(),
  notes: z.string().optional(),
});

type AssignData = z.infer<typeof assignSchema>;
type OfflineData = z.infer<typeof offlineSchema>;

const statusVariant = (s: FeeStatus): 'green' | 'red' | 'yellow' | 'blue' | 'gray' => {
  const m: Record<FeeStatus, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
    paid: 'green',
    overdue: 'red',
    pending: 'yellow',
    partial: 'blue',
    waived: 'gray',
  };
  return m[s];
};

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function StudentFeesPage() {
  const { toast } = useToast();
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const assignForm = useForm<AssignData>({ resolver: zodResolver(assignSchema) });
  const offlineForm = useForm<OfflineData>({ resolver: zodResolver(offlineSchema) });

  async function fetchFees(status?: string) {
    try {
      setLoading(true);
      const qs = status ? `?status=${status}&limit=100` : '?limit=100';
      const [feesRes, studentsRes, structuresRes] = await Promise.all([
        api.get<{ data: StudentFee[]; total: number }>(`/student-fees${qs}`),
        api.get<{ data: Student[]; meta: { total: number } }>('/students?limit=100'),
        api.get<FeeStructure[]>('/fee-structures'),
      ]);
      setFees(feesRes.data);
      setTotal(feesRes.total);
      setStudents(studentsRes.data);
      setStructures(structuresRes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFees();
  }, []);

  async function onAssign(data: AssignData) {
    try {
      await api.post('/student-fees', data);
      toast('Fee assigned', 'success');
      setShowAssign(false);
      assignForm.reset();
      fetchFees(statusFilter);
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  async function onOfflinePayment(data: OfflineData) {
    try {
      const { studentFeeId, ...body } = data;
      const res = await api.post<{ studentFee: StudentFee; receipt: { id: string } }>(
        `/student-fees/${studentFeeId}/offline-payment`,
        {
          ...body,
          reference: body.reference || undefined,
          paidOn: body.paidOn || undefined,
        },
      );
      toast('Offline payment recorded', 'success');
      setSelectedFee(null);
      offlineForm.reset();
      fetchFees(statusFilter);
      window.open(`/receipts/${res.receipt.id}/print`, '_blank');
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  function openOffline(fee: StudentFee) {
    setSelectedFee(fee);
    offlineForm.setValue('studentFeeId', fee.id);
    offlineForm.setValue('paidOn', new Date().toISOString().slice(0, 10));
  }

  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.admissionNo})`,
  }));

  const structureOptions = structures.map((s) => ({
    value: s.id,
    label: `${s.name} — ${formatCurrency(s.totalAmount)}`,
  }));

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'partial', label: 'Partial' },
    { value: 'paid', label: 'Paid' },
    { value: 'waived', label: 'Waived' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              fetchFees(e.target.value || undefined);
            }}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">{total} record{total !== 1 ? 's' : ''}</span>
        </div>
        <Button onClick={() => setShowAssign(true)}>+ Assign Fee</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : fees.length === 0 ? (
        <EmptyState
          title="No fee records"
          description="Assign fee structures to students to start tracking payments."
          action={<Button onClick={() => setShowAssign(true)}>+ Assign Fee</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Student', 'Fee', 'Due', 'Paid', 'Balance', 'Status', 'Due Date', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{f.student?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{f.student?.admissionNo ?? ''}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{f.feeStructure?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(f.amountDue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(f.amountPaid)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(Math.max(0, f.amountDue - f.amountPaid))}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(f.dueDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {f.status !== 'paid' && f.status !== 'waived' && (
                      <button
                        onClick={() => openOffline(f)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Record payment
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign fee modal */}
      <Modal
        open={showAssign}
        onClose={() => { setShowAssign(false); assignForm.reset(); }}
        title="Assign Fee"
      >
        <form onSubmit={assignForm.handleSubmit(onAssign)} className="space-y-4">
          <Select
            label="Student"
            options={studentOptions}
            placeholder="Select a student"
            error={assignForm.formState.errors.studentId?.message}
            {...assignForm.register('studentId')}
          />
          <Select
            label="Fee Structure"
            options={structureOptions}
            placeholder="Select a fee structure"
            error={assignForm.formState.errors.feeStructureId?.message}
            {...assignForm.register('feeStructureId')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAssign(false); assignForm.reset(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={assignForm.formState.isSubmitting}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      {/* Offline payment modal */}
      <Modal
        open={!!selectedFee}
        onClose={() => { setSelectedFee(null); offlineForm.reset(); }}
        title="Record Offline Payment"
      >
        {selectedFee && (
          <form onSubmit={offlineForm.handleSubmit(onOfflinePayment)} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{selectedFee.student?.name}</p>
              <p className="text-gray-600">{selectedFee.feeStructure?.name}</p>
              <p className="mt-1 text-gray-500">
                Balance: <span className="font-semibold text-gray-900">{formatCurrency(Math.max(0, selectedFee.amountDue - selectedFee.amountPaid))}</span>
              </p>
            </div>
            <Input
              label="Amount (₹)"
              type="number"
              step="0.01"
              placeholder="e.g. 1000"
              error={offlineForm.formState.errors.amount?.message}
              {...offlineForm.register('amount', { valueAsNumber: true })}
            />
            <Select
              label="Method"
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'demand_draft', label: 'Demand Draft' },
              ]}
              error={offlineForm.formState.errors.method?.message}
              {...offlineForm.register('method')}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reference (optional)"
                placeholder="Cheque no. / UTR / DD no."
                {...offlineForm.register('reference')}
              />
              <Input
                label="Paid On"
                type="date"
                {...offlineForm.register('paidOn')}
              />
            </div>
            <Input
              label="Notes (optional)"
              placeholder="Any additional notes"
              {...offlineForm.register('notes')}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setSelectedFee(null); offlineForm.reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={offlineForm.formState.isSubmitting}>
                Record Payment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
