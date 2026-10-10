'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { feeStatusLabel } from '../../../lib/i18n/labels';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { formatDateOnly, formatRupees } from '../../../lib/format';

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

const makeSchemas = (t: ReturnType<typeof useTranslations<'studentFees'>>) => ({
  assign: z.object({
    studentId: z.string().min(1, t('studentRequired')),
    feeStructureId: z.string().min(1, t('structureRequired')),
  }),
  offline: z.object({
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
    .refine((rows) => rows.some((r) => r.amount > 0), t('allocationRequired')),
  method: z.enum(['cash', 'cheque', 'bank_transfer', 'demand_draft']),
  reference: z.string().optional(),
  paidOn: z.string().optional(),
  notes: z.string().optional(),
  discountTypeId: z.string().optional(),
  discountAmount: z.number().optional(),
  discountNote: z.string().optional(),
  }),
});

type AssignData = z.infer<ReturnType<typeof makeSchemas>['assign']>;
type OfflineData = z.infer<ReturnType<typeof makeSchemas>['offline']>;

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

export default function StudentFeesPage() {
  const t = useTranslations('studentFees');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('feeStatus');
  const tMethod = useTranslations('paymentMethod');
  const errorText = useErrorText();
  const schemas = useMemo(() => makeSchemas(t), [t]);
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

  const assignForm = useForm<AssignData>({ resolver: zodResolver(schemas.assign) });
  const offlineForm = useForm<OfflineData>({
    resolver: zodResolver(schemas.offline),
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
      setError(errorText(e));
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
      toast(t('assigned'), 'success');
      setShowAssign(false);
      assignForm.reset();
      fetchFees(statusFilter);
    } catch (e) {
      toast(errorText(e), 'error');
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
      toast(t('paymentRecorded'), 'success');
      setSelectedFee(null);
      offlineForm.reset({ allocations: [] });
      fetchFees(statusFilter);
      window.open(`/receipts/${res.receipt.id}/print`, '_blank');
    } catch (e) {
      toast(errorText(e), 'error');
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
    label: `${s.name} — ${formatRupees(s.totalAmount)}`,
  }));

  const statusOptions = [
    { value: '', label: t('allStatuses') },
    ...(['pending', 'overdue', 'partial', 'paid', 'waived'] as const).map((value) => ({ value, label: tStatus(value) })),
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
          <span className="text-sm text-gray-500">{t('count', { count: total })}</span>
        </div>
        <Button onClick={() => setShowAssign(true)}>{t('assign')}</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : fees.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<Button onClick={() => setShowAssign(true)}>{t('assign')}</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colStudent'), t('colFee'), t('colDue'), t('colPaid'), t('colBalance'), t('colStatus'), t('colDueDate'), ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
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
                  <td className="px-6 py-4 text-sm text-gray-600">{formatRupees(f.amountDue)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatRupees(f.amountPaid)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatRupees(Math.max(0, f.amountDue - f.amountPaid))}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant(f.status)}>{feeStatusLabel(tStatus, f.status)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDateOnly(f.dueDate)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {f.status !== 'paid' && f.status !== 'waived' && (
                      <button
                        onClick={() => openOffline(f)}
                        className="text-xs text-teal hover:underline"
                      >
                        {t('recordPayment')}
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
        title={t('assignTitle')}
      >
        <form onSubmit={assignForm.handleSubmit(onAssign)} className="space-y-4">
          <Select
            label={t('student')} required
            options={studentOptions}
            placeholder={t('selectStudent')}
            error={assignForm.formState.errors.studentId?.message}
            {...assignForm.register('studentId')}
          />
          <Select
            label={t('feeStructure')} required
            options={structureOptions}
            placeholder={t('selectStructure')}
            error={assignForm.formState.errors.feeStructureId?.message}
            {...assignForm.register('feeStructureId')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAssign(false); assignForm.reset(); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={assignForm.formState.isSubmitting}>
              {t('assignSubmit')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Offline payment modal */}
      <Modal
        open={!!selectedFee}
        onClose={() => { setSelectedFee(null); offlineForm.reset(); }}
        title={t('offlineTitle')}
      >
        {selectedFee && (
          <form onSubmit={offlineForm.handleSubmit(onOfflinePayment)} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{selectedFee.student?.name}</p>
              <p className="text-gray-600">{selectedFee.feeStructure?.name}</p>
              <p className="mt-1 text-gray-500">
                {t('balance')} <span className="font-semibold text-gray-900">{formatRupees(Math.max(0, selectedFee.amountDue - selectedFee.amountPaid))}</span>
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">{t('perComponent')}<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></p>
              {allocationFields.fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <label htmlFor={`allocation-${index}`} className="text-sm text-gray-600">
                    {field.label} <span className="text-gray-400">{t('componentBalance', { amount: formatRupees(field.balance) })}</span>
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
              label={t('method')} required
              options={[
                { value: 'cash', label: tMethod('cash') },
                { value: 'cheque', label: tMethod('cheque') },
                { value: 'bank_transfer', label: tMethod('bankTransferOnly') },
                { value: 'demand_draft', label: tMethod('demand_draft') },
              ]}
              error={offlineForm.formState.errors.method?.message}
              {...offlineForm.register('method')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('reference')}
                placeholder={t('referencePlaceholder')}
                {...offlineForm.register('reference')}
              />
              <Input
                label={t('paidOn')}
                type="date"
                {...offlineForm.register('paidOn')}
              />
            </div>
            <Input
              label={t('notes')}
              placeholder={t('notesPlaceholder')}
              {...offlineForm.register('notes')}
            />
            <Select
              label={t('discountType')}
              options={discountTypes.map((d) => ({ value: d.id, label: d.name }))}
              placeholder={t('discountNone')}
              {...offlineForm.register('discountTypeId')}
            />
            {selectedDiscountTypeId && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t('discountAmount')}
                  type="number"
                  step="0.01"
                  {...offlineForm.register('discountAmount', { valueAsNumber: true })}
                />
                <Input
                  label={t('discountNote')}
                  placeholder={t('discountNotePlaceholder')}
                  {...offlineForm.register('discountNote')}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setSelectedFee(null); offlineForm.reset(); }}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" loading={offlineForm.formState.isSubmitting}>
                {t('recordSubmit')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
