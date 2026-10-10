'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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

interface Class {
  id: string;
  name: string;
  academicYear: string;
  section: string | null;
  teachers: Array<{ isClassTeacher: boolean; teacher: { id: string; name: string } }>;
  _count?: { students: number };
}

interface Teacher {
  id: string;
  name: string;
}

const makeSchemas = (t: ReturnType<typeof useTranslations<'classes'>>) => ({
  create: z.object({
    name: z.string().min(1, t('nameRequired')),
    academicYear: z.string().min(4, t('yearHint')),
    section: z.string().optional(),
  }),
  assign: z.object({
    teacherId: z.string().min(1, t('selectTeacher')),
  }),
});

type FormData = z.infer<ReturnType<typeof makeSchemas>['create']>;
type AssignFormData = z.infer<ReturnType<typeof makeSchemas>['assign']>;

export default function ClassesPage() {
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const schemas = useMemo(() => makeSchemas(t), [t]);
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [assigningClass, setAssigningClass] = useState<Class | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schemas.create) });

  const {
    register: registerAssign,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    formState: { errors: assignErrors, isSubmitting: isAssignSubmitting },
  } = useForm<AssignFormData>({ resolver: zodResolver(schemas.assign) });

  async function fetchClasses() {
    try {
      setLoading(true);
      const [classRes, teacherRes] = await Promise.all([
        api.get<Class[]>('/classes'),
        api.get<{ data: Teacher[]; meta: { total: number } }>('/users?role=teacher&limit=200'),
      ]);
      setClasses(classRes);
      setTotal(classRes.length);
      setTeachers(teacherRes.data);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClasses();
  }, []);

  async function onSubmit(data: FormData) {
    try {
      await api.post('/classes', {
        ...data,
        section: data.section || undefined,
      });
      toast(t('created'), 'success');
      setShowModal(false);
      reset();
      fetchClasses();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  function openAssign(cls: Class) {
    setAssigningClass(cls);
    resetAssign({ teacherId: '' });
  }

  async function onAssignSubmit(data: AssignFormData) {
    if (!assigningClass) return;
    try {
      await api.post(`/classes/${assigningClass.id}/teachers`, {
        teacherId: data.teacherId,
        isClassTeacher: true,
      });
      toast(t('teacherAssigned'), 'success');
      setAssigningClass(null);
      fetchClasses();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const teacherOptions = teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }));

  function classTeacherNames(cls: Class): string {
    const names = cls.teachers.filter((ct) => ct.isClassTeacher).map((ct) => ct.teacher.name);
    return names.length > 0 ? names.join(', ') : '—';
  }

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
      ) : classes.length === 0 ? (
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
                {[t('colName'), t('colYear'), t('colSection'), t('colClassTeacher'), t('colStudents'), ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.academicYear}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.section ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{classTeacherNames(c)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c._count?.students ?? 0}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openAssign(c)}
                      className="text-xs text-teal hover:underline"
                    >
                      {t('assignTeacher')}
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
        onClose={() => { setShowModal(false); reset(); }}
        title={t('addTitle')}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label={t('className')} required placeholder={t('classNamePlaceholder')} error={errors.name?.message} {...register('name')} />
          <Input label={t('academicYear')} required placeholder={t('academicYearPlaceholder')} error={errors.academicYear?.message} {...register('academicYear')} />
          <Input label={t('section')} placeholder={t('sectionPlaceholder')} error={errors.section?.message} {...register('section')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!assigningClass}
        onClose={() => setAssigningClass(null)}
        title={t('assignTitle', { name: assigningClass?.name ?? '' })}
      >
        <form onSubmit={handleAssignSubmit(onAssignSubmit)} className="space-y-4">
          <Select
            label={t('teacher')} required
            options={teacherOptions}
            placeholder={t('selectTeacher')}
            error={assignErrors.teacherId?.message}
            {...registerAssign('teacherId')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAssigningClass(null)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isAssignSubmitting}>
              {t('assign')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
