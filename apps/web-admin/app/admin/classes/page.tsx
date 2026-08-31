'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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

interface Class {
  id: string;
  name: string;
  academicYear: string;
  section: string | null;
  teacherId: string | null;
  teacher?: { id: string; name: string };
  _count?: { students: number };
}

interface Teacher {
  id: string;
  name: string;
}

const schema = z.object({
  name: z.string().min(1, 'Class name is required'),
  academicYear: z.string().min(4, 'e.g. 2024-25'),
  section: z.string().optional(),
  teacherId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ClassesPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

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
      setError((e as Error).message);
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
        teacherId: data.teacherId || undefined,
        section: data.section || undefined,
      });
      toast('Class created', 'success');
      setShowModal(false);
      reset();
      fetchClasses();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} class{total !== 1 ? 'es' : ''}</p>
        <Button onClick={() => setShowModal(true)}>+ Add Class</Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Create a class to start enrolling students."
          action={<Button onClick={() => setShowModal(true)}>+ Add Class</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Academic Year', 'Section', 'Class Teacher', 'Students'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                  <td className="px-6 py-4 text-sm text-gray-600">{c.teacher?.name ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c._count?.students ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset(); }}
        title="Add Class"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Class Name" placeholder="e.g. Grade 5" error={errors.name?.message} {...register('name')} />
          <Input label="Academic Year" placeholder="2024-25" error={errors.academicYear?.message} {...register('academicYear')} />
          <Input label="Section" placeholder="A" error={errors.section?.message} {...register('section')} />
          <Select
            label="Class Teacher (optional)"
            options={teacherOptions}
            placeholder="Select a teacher"
            error={errors.teacherId?.message}
            {...register('teacherId')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create Class
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
