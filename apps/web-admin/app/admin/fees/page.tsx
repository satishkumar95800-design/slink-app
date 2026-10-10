'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { formatDateOnly, formatRupees } from '../../../lib/format';

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

const makeSchema = (t: ReturnType<typeof useTranslations<'fees'>>, tCommon: ReturnType<typeof useTranslations<'common'>>) =>
  z.object({
    name: z.string().min(1, tCommon('nameRequired')),
    classId: z.string().min(1, tCommon('classRequired')),
    academicYear: z.string().min(4, t('yearHint')),
    dueDate: z.string().min(1, t('dueDateRequired')),
    lateFeePerDay: z.number().min(0),
    items: z
      .array(z.object({ label: z.string().min(1, t('labelRequired')), amount: z.number().min(1, t('amountRequired')) }))
      .min(1, t('itemsRequired')),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

export default function FeesPage() {
  const t = useTranslations('fees');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const schema = useMemo(() => makeSchema(t, tCommon), [t, tCommon]);
  const { toast } = useToast();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);

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

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    control: controlEdit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { items: [{ label: '', amount: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const { fields: editFields, append: appendEdit, remove: removeEdit } = useFieldArray({ control: controlEdit, name: 'items' });

  async function fetchData() {
    try {
      setLoading(true);
      const [feesRes, classRes] = await Promise.all([
        api.get<FeeStructure[]>('/fee-structures'),
        api.get<Class[]>('/classes'),
      ]);
      setStructures(feesRes);
      setTotal(feesRes.length);
      setClasses(classRes);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function onSubmit(data: FormData) {
    try {
      await api.post('/fee-structures', data);
      toast(t('created'), 'success');
      setShowModal(false);
      reset({ items: [{ label: '', amount: 0 }] });
      fetchData();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  function openEdit(structure: FeeStructure) {
    setEditingStructure(structure);
    resetEdit({
      name: structure.name,
      classId: structure.classId,
      academicYear: structure.academicYear,
      dueDate: structure.dueDate.slice(0, 10),
      lateFeePerDay: structure.lateFeePerDay,
      items: (structure.items ?? [{ label: '', amount: 0 }]).map((item) => ({ label: item.label, amount: Number(item.amount) })),
    });
  }

  async function onEditSubmit(data: FormData) {
    if (!editingStructure) return;
    try {
      await api.patch(`/fee-structures/${editingStructure.id}`, data);
      toast(t('updated'), 'success');
      setEditingStructure(null);
      fetchData();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.academicYear})`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{t('count', { count: total })}</p>
        <Button onClick={() => setShowModal(true)}>{t('add')}</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : structures.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<Button onClick={() => setShowModal(true)}>{t('add')}</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colName'), t('colClass'), t('colYear'), t('colTotal'), t('colDueDate'), t('colLateFee'), ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
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
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{formatRupees(s.totalAmount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDateOnly(s.dueDate)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.lateFeePerDay ? formatRupees(s.lateFeePerDay) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(s)} className="text-xs text-teal hover:underline">
                      {tCommon('edit')}
                    </button>
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
        title={t('addTitle')}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('name')} required placeholder={t('namePlaceholder')} error={errors.name?.message} {...register('name')} />
            <Select
              label={t('class')} required
              options={classOptions}
              placeholder={tCommon('selectClass')}
              error={errors.classId?.message}
              {...register('classId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label={t('academicYear')} required placeholder={t('academicYearPlaceholder')} error={errors.academicYear?.message} {...register('academicYear')} />
            <Input label={t('dueDate')} required type="date" error={errors.dueDate?.message} {...register('dueDate')} />
            <Input
              label={t('lateFee')}
              type="number"
              step="0.01"
              placeholder="0"
              error={errors.lateFeePerDay?.message}
              {...register('lateFeePerDay', { valueAsNumber: true })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('items')}<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></p>
              <button
                type="button"
                onClick={() => append({ label: '', amount: 0 })}
                className="text-xs text-teal hover:underline"
              >
                {t('addItem')}
              </button>
            </div>
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    className="min-w-0 flex-1 basis-full rounded-md border border-gray-300 px-3 py-1.5 sm:basis-auto text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                    placeholder={t('itemLabelPlaceholder')}
                    {...register(`items.${idx}.label`)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="w-28 flex-1 rounded-md border sm:w-32 sm:flex-none border-gray-300 px-3 py-1.5 text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                    placeholder={t('itemAmountPlaceholder')}
                    {...register(`items.${idx}.amount`, { valueAsNumber: true })}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="px-2 text-gray-400 hover:text-red-600"
                      aria-label={t('removeItem')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.items && (
              <p className="mt-1 text-xs text-red-600">
                {typeof errors.items.message === 'string' ? errors.items.message : t('fixItems')}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset({ items: [{ label: '', amount: 0 }] }); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingStructure}
        onClose={() => setEditingStructure(null)}
        title={t('editTitle')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('name')} required placeholder={t('namePlaceholder')} error={editErrors.name?.message} {...registerEdit('name')} />
            <Select
              label={t('class')} required
              options={classOptions}
              placeholder={tCommon('selectClass')}
              error={editErrors.classId?.message}
              {...registerEdit('classId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label={t('academicYear')} required placeholder={t('academicYearPlaceholder')} error={editErrors.academicYear?.message} {...registerEdit('academicYear')} />
            <Input label={t('dueDate')} required type="date" error={editErrors.dueDate?.message} {...registerEdit('dueDate')} />
            <Input
              label={t('lateFee')}
              type="number"
              step="0.01"
              placeholder="0"
              error={editErrors.lateFeePerDay?.message}
              {...registerEdit('lateFeePerDay', { valueAsNumber: true })}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('items')}<span className="ml-0.5 text-red-500" aria-hidden="true">*</span></p>
              <button
                type="button"
                onClick={() => appendEdit({ label: '', amount: 0 })}
                className="text-xs text-teal hover:underline"
              >
                {t('addItem')}
              </button>
            </div>
            <div className="space-y-2">
              {editFields.map((field, idx) => (
                <div key={field.id} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    className="min-w-0 flex-1 basis-full rounded-md border border-gray-300 px-3 py-1.5 sm:basis-auto text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                    placeholder={t('itemLabelPlaceholder')}
                    {...registerEdit(`items.${idx}.label`)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="w-28 flex-1 rounded-md border sm:w-32 sm:flex-none border-gray-300 px-3 py-1.5 text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                    placeholder={t('itemAmountPlaceholder')}
                    {...registerEdit(`items.${idx}.amount`, { valueAsNumber: true })}
                  />
                  {editFields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEdit(idx)}
                      className="px-2 text-gray-400 hover:text-red-600"
                      aria-label={t('removeItem')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editErrors.items && (
              <p className="mt-1 text-xs text-red-600">
                {typeof editErrors.items.message === 'string' ? editErrors.items.message : t('fixItems')}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingStructure(null)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isEditSubmitting}>
              {tCommon('saveChanges')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
