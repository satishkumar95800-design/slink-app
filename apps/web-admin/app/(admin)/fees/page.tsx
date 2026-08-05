'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

interface FeeStructure {
  id: string;
  name: string;
  totalAmount: number;
  dueDate: string;
  lateFeePerDay: number;
  academicYear: string;
  classId: string;
  class?: { name: string };
  items?: { label: string; amount: number }[];
}

interface Class {
  id: string;
  name: string;
  academicYear: string;
}

const feeItemSchema = z.object({
  label: z.string().min(1, 'Label required'),
  amount: z.number().min(1, 'Amount required'),
});

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  classId: z.string().min(1, 'Class is required'),
  academicYear: z.string().min(4, 'e.g. 2024-25'),
  dueDate: z.string().min(1, 'Due date is required'),
  lateFeePerDay: z.number().min(0),
  items: z.array(feeItemSchema).min(1, 'Add at least one fee item'),
});

type FormData = z.infer<typeof schema>;

function formatCurrency(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function FeesPage() {
  const { toast } = useToast();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ label: '', amount: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  async function fetchData() {
    try {
      setLoading(true);
      const [feesRes, classRes] = await Promise.all([
        api.get<{ data: FeeStructure[]; total: number }>('/fees/structures?limit=100'),
        api.get<{ data: Class[]; total: number }>('/students/classes?limit=200'),
      ]);
      setStructures(feesRes.data);
      setTotal(feesRes.total);
      setClasses(classRes.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function onSubmit(data: FormData) {
    try {
      await api.post('/fees/structures', data);
      toast('Fee structure created', 'success');
      setShowModal(false);
      reset({ items: [{ label: '', amount: 0 }] });
      fetchData();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.academicYear})`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} structure{total !== 1 ? 's' : ''}</p>
        <Button onClick={() => setShowModal(true)}>+ Add Structure</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : structures.length === 0 ? (
        <EmptyState
          title="No fee structures"
          description="Define fee templates for each class."
          action={<Button onClick={() => setShowModal(true)}>+ Add Structure</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Class', 'Academic Year', 'Total', 'Due Date', 'Late Fee/Day'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {structures.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.class?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.academicYear}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(s.dueDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.lateFeePerDay ? formatCurrency(s.lateFeePerDay) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset({ items: [{ label: '', amount: 0 }] }); }}
        title="Add Fee Structure"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" placeholder="Annual Fees" error={errors.name?.message} {...register('name')} />
            <Select
              label="Class"
              options={classOptions}
              placeholder="Select a class"
              error={errors.classId?.message}
              {...register('classId')}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Academic Year" placeholder="2024-25" error={errors.academicYear?.message} {...register('academicYear')} />
            <Input label="Due Date" type="date" error={errors.dueDate?.message} {...register('dueDate')} />
            <Input
              label="Late Fee / Day (₹ paise)"
              type="number"
              placeholder="0"
              error={errors.lateFeePerDay?.message}
              {...register('lateFeePerDay', { valueAsNumber: true })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Fee Items</p>
              <button
                type="button"
                onClick={() => append({ label: '', amount: 0 })}
                className="text-xs text-blue-600 hover:underline"
              >
                + Add item
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Label (e.g. Tuition)"
                    {...register(`items.${idx}.label`)}
                  />
                  <input
                    type="number"
                    className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Amount (₹ paise)"
                    {...register(`items.${idx}.amount`, { valueAsNumber: true })}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="px-2 text-gray-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.items && (
              <p className="mt-1 text-xs text-red-600">
                {typeof errors.items.message === 'string' ? errors.items.message : 'Fix fee items'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset({ items: [{ label: '', amount: 0 }] }); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Structure
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
