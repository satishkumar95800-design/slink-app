'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
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

interface StudentFeeComponent {
  id: string;
  amountDue: number;
  amountPaid: number;
  feeItem: { id: string; label: string };
}

interface StudentFee {
  id: string;
  studentId: string;
  amountDue: number;
  amountPaid: number;
  status: FeeStatus;
  dueDate: string;
  student?: { name: string; admissionNo: string };
  feeStructure?: { name: string };
  components: StudentFeeComponent[];
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

interface DiscountType {
  id: string;
  name: string;
}

const assignSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  feeStructureId: z.string().min(1, 'Fee structure is required'),
});

const offlineSchema = z.object({
  studentFeeId: z.string().min(1),
  allocations: z
    .array(
      z.object({
        studentFeeComponentId: z.string(),
        label: z.string(),
        balance: z.number(),
        amount: z.number().min(0),
      }),
    )
    .refine((rows) => rows.some((r) => r.amount > 0), 'Enter an amount for at least one fee component'),
  method: z.enum(['cash', 'cheque', 'bank_transfer', 'demand_draft']),
  reference: z.string().optional(),
  paidOn: z.string().optional(),
  notes: z.string().optional(),
  discountTypeId: z.string().optional(),
  discountAmount: z.number().optional(),
  discountNote: z.string().optional(),
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
  const [discountTypes, setDiscountTypes] = useState<DiscountType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const assignForm = useForm<AssignData>({ resolver: zodResolver(assignSchema) });
  const offlineForm = useForm<OfflineData>({
    resolver: zodResolver(offlineSchema),
    defaultValues: { allocations: [] },
  });
  const allocationFields = useFieldArray({ control: offlineForm.control, name: 'allocations' });
  const selectedDiscountTypeId = offlineForm.watch('discountTypeId');

  async function fetchFees(status?: string) {
    try {
      setLoading(true);
      const qs = status ? `?status=${status}&limit=100` : '?limit=100';
      const [feesRes, studentsRes, structuresRes, discountTypesRes] = await Promise.all([
        api.get<{ data: StudentFee[]; total: number }>(`/student-fees${qs}`),
        api.get<{ data: Student[]; meta: { total: number } }>('/students?limit=100'),
        api.get<FeeStructure[]>('/fee-structures'),
        api.get<DiscountType[]>('/discount-types'),
      ]);
      setFees(feesRes.data);
      setTotal(feesRes.total);
      setStudents(studentsRes.data);
      setStructures(structuresRes);
      setDiscountTypes(discountTypesRes);
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
      const allocations = data.allocations
        .filter((a) => a.amount > 0)
        .map((a) => ({ studentFeeComponentId: a.studentFeeComponentId, amount: a.amount }));
      const res = await api.post<{ studentFee: StudentFee; receipt: { id: string } }>(
        `/student-fees/${data.studentFeeId}/offline-payment`,
        {
          allocations,
          method: data.method,
          reference: data.reference || undefined,
          paidOn: data.paidOn || undefined,
          notes: data.notes || undefined,
          discountTypeId: data.discountTypeId || undefined,
          discountAmount: data.discountTypeId ? data.discountAmount : undefined,
          discountNote: data.discountTypeId ? data.discountNote || undefined : undefined,
        },
      );
      toast('Offline payment recorded', 'success');
      setSelectedFee(null);
      offlineForm.reset({ allocations: [] });
      fetchFees(statusFilter);
      window.open(`/receipts/${res.receipt.id}/print`, '_blank');
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  function openOffline(fee: StudentFee) {
    setSelectedFee(fee);
    offlineForm.reset({
      studentFeeId: fee.id,
      paidOn: new Date().toISOString().slice(0, 10),
      allocations: fee.components
        .filter((c) => c.amountDue - c.amountPaid > 0)
        .map((c) => ({
          studentFeeComponentId: c.id,
          label: c.feeItem.label,
          balance: c.amountDue - c.amountPaid,
          amount: c.amountDue - c.amountPaid,
        })),
    });
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
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-coral focus:ring-1 focus:ring-coral outline-none"
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
          <Spinner className="h-8 w-8 text-teal" />
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
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {['Student', 'Fee', 'Due', 'Paid', 'Balance', 'Status', 'Due Date', ''].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/admin/students/${f.studentId}`} className="text-sm font-medium text-teal hover:underline">
                      {f.student?.name ?? '—'}
                    </Link>
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
                        className="text-xs text-teal hover:underline"
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
            label="Student" required
            options={studentOptions}
            placeholder="Select a student"
            error={assignForm.formState.errors.studentId?.message}
            {...assignForm.register('studentId')}
          />
          <Select
            label="Fee Structure" required
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
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Amount per fee component (₹)<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></p>
              {allocationFields.fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <label htmlFor={`allocation-${index}`} className="text-sm text-gray-600">
                    {field.label} <span className="text-gray-400">(balance {formatCurrency(field.balance)})</span>
                  </label>
                  <Input
                    id={`allocation-${index}`}
                    type="number"
                    step="0.01"
                    className="sm:w-32"
                    {...offlineForm.register(`allocations.${index}.amount`, { valueAsNumber: true })}
                  />
                </div>
              ))}
              {offlineForm.formState.errors.allocations && (
                <p className="text-xs text-red-600">{offlineForm.formState.errors.allocations.message}</p>
              )}
            </div>
            <Select
              label="Method" required
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'demand_draft', label: 'Demand Draft' },
              ]}
              error={offlineForm.formState.errors.method?.message}
              {...offlineForm.register('method')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Select
              label="Discount/Concession Type (optional)"
              options={discountTypes.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="None"
              {...offlineForm.register('discountTypeId')}
            />
            {selectedDiscountTypeId && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Discount Amount (₹)"
                  type="number"
                  step="0.01"
                  {...offlineForm.register('discountAmount', { valueAsNumber: true })}
                />
                <Input
                  label="Note"
                  placeholder="e.g. Sibling of ADM-2025-0001"
                  {...offlineForm.register('discountNote')}
                />
              </div>
            )}
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
