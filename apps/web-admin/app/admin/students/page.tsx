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

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  dob: string | null;
  classId: string;
  class?: { name: string; academicYear: string };
  createdAt: string;
}

interface Class {
  id: string;
  name: string;
  academicYear: string;
}

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  admissionNo: z.string().min(1, 'Admission number is required'),
  dob: z.string().optional(),
  classId: z.string().min(1, 'Class is required'),
  parentPhone: z.string().min(10, 'Enter a valid phone number'),
  parentRelation: z.enum(['father', 'mother', 'guardian']).optional(),
});

type FormData = z.infer<typeof schema>;

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function fetchStudents(q?: string) {
    try {
      setLoading(true);
      const qs = q ? `?search=${encodeURIComponent(q)}&limit=100` : '?limit=100';
      const [studentRes, classRes] = await Promise.all([
        api.get<{ data: Student[]; meta: { total: number } }>(`/students${qs}`),
        api.get<Class[]>('/classes'),
      ]);
      setStudents(studentRes.data);
      setTotal(studentRes.meta.total);
      setClasses(classRes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    fetchStudents(search);
  }

  async function onSubmit(data: FormData) {
    try {
      await api.post('/students', {
        ...data,
        dob: data.dob || undefined,
        parentRelation: data.parentRelation || undefined,
      });
      toast('Student added', 'success');
      setShowModal(false);
      reset();
      fetchStudents();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.academicYear})`,
  }));

  const relationOptions = [
    { value: 'father', label: 'Father' },
    { value: 'mother', label: 'Mother' },
    { value: 'guardian', label: 'Guardian' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Search by name or admission no…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="secondary" size="sm" type="submit">Search</Button>
        </form>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{total} student{total !== 1 ? 's' : ''}</span>
          <Button onClick={() => setShowModal(true)}>+ Add Student</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : students.length === 0 ? (
        <EmptyState
          title="No students found"
          description="Add students and link them to their parents."
          action={<Button onClick={() => setShowModal(true)}>+ Add Student</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Admission No', 'Name', 'Class', 'Date of Birth', 'Enrolled'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">{s.admissionNo}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.class ? `${s.class.name} (${s.class.academicYear})` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(s.createdAt).toLocaleDateString('en-IN')}
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
        title="Add Student"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" error={errors.name?.message} {...register('name')} />
            <Input label="Admission No" error={errors.admissionNo?.message} {...register('admissionNo')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Birth" type="date" error={errors.dob?.message} {...register('dob')} />
            <Select
              label="Class"
              options={classOptions}
              placeholder="Select a class"
              error={errors.classId?.message}
              {...register('classId')}
            />
          </div>
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Parent / Guardian</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Parent Phone" placeholder="+91..." error={errors.parentPhone?.message} {...register('parentPhone')} />
              <Select
                label="Relation"
                options={relationOptions}
                placeholder="Select relation"
                error={errors.parentRelation?.message}
                {...register('parentRelation')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Add Student
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
