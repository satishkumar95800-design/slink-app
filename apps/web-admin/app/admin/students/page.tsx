'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

const BLOOD_GROUP_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const CASTE_VALUES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'] as const;

// The API stores/returns Prisma-safe identifiers (A_POSITIVE, etc.) since "+"/"-"
// aren't valid enum identifiers; translate back to "A+"/"A-" for display here.
const BLOOD_GROUP_ENUM_TO_DISPLAY: Record<string, string> = {
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
};

interface Student {
  id: string;
  name: string;
  admissionNo: string;
  dob: string | null;
  bloodGroup: string | null;
  caste: string | null;
  photoUrl?: string | null;
  classId: string;
  class?: { name: string; academicYear: string };
  parents?: Array<{ relation: string; isPrimary: boolean; parent: { id: string; name: string; phone: string | null; profession?: string | null } }>;
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
  bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
  caste: z.enum(CASTE_VALUES).optional(),
  classId: z.string().min(1, 'Class is required'),
  parentPhone: z.string().min(10, 'Enter a valid phone number'),
  parentRelation: z.enum(['father', 'mother', 'guardian']).optional(),
});

type FormData = z.infer<typeof schema>;

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  classId: z.string().min(1, 'Class is required'),
  dob: z.string().optional(),
  bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
  caste: z.enum(CASTE_VALUES).optional(),
  parentProfession: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

export default function StudentsPage() {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isTeacher = getSession()?.role === 'teacher';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditFormData>({ resolver: zodResolver(editSchema) });

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
        bloodGroup: data.bloodGroup || undefined,
        caste: data.caste || undefined,
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

  async function handleStudentPhotoUpload(file: File) {
    if (!editingStudent) return;

    const payload = new FormData();
    payload.append('file', file);
    payload.append('category', 'student_photo');
    payload.append('entityId', editingStudent.id);

    const authToken = localStorage.getItem('slink_token');
    const tenantId = localStorage.getItem('slink_tenant_id');

    const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1'}/files/upload`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      },
      body: payload,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.json().catch(() => ({}));
      throw new Error((body as { message?: string })?.message ?? 'Photo upload failed');
    }

    const uploaded = await uploadRes.json() as { key: string };
    const signed = await api.get<{ url: string }>(`/files/signed-url?key=${encodeURIComponent(uploaded.key)}`);
    await api.patch(`/students/${editingStudent.id}`, { photoUrl: signed.url });
    toast('Student photo updated', 'success');
    fetchStudents();
    setEditingStudent((current) => current ? { ...current, photoUrl: signed.url } : current);
  }

  function openEdit(student: Student) {
    setEditingStudent(student);
    const primaryParent = student.parents?.[0]?.parent;
    resetEdit({
      name: student.name,
      classId: student.classId,
      dob: student.dob ? student.dob.slice(0, 10) : '',
      bloodGroup: student.bloodGroup
        ? (BLOOD_GROUP_ENUM_TO_DISPLAY[student.bloodGroup] as (typeof BLOOD_GROUP_VALUES)[number])
        : undefined,
      caste: (student.caste as (typeof CASTE_VALUES)[number]) || undefined,
      parentProfession: primaryParent?.profession ?? '',
    });
  }

  async function onEditSubmit(data: EditFormData) {
    if (!editingStudent) return;
    try {
      await api.patch(`/students/${editingStudent.id}`, {
        name: data.name,
        classId: data.classId,
        dob: data.dob || undefined,
        bloodGroup: data.bloodGroup || undefined,
        caste: data.caste || undefined,
      });

      const primaryParent = editingStudent.parents?.[0]?.parent;
      if (primaryParent && data.parentProfession !== undefined) {
        await api.patch(`/users/${primaryParent.id}`, {
          profession: data.parentProfession || undefined,
        });
      }

      toast('Student updated', 'success');
      setEditingStudent(null);
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

  const bloodGroupOptions = BLOOD_GROUP_VALUES.map((v) => ({ value: v, label: v }));
  const casteOptions = CASTE_VALUES.map((v) => ({ value: v, label: v }));

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
                {['Admission No', 'Name', 'Class', 'Date of Birth', 'Blood Group', 'Enrolled', ''].map((h) => (
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
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-gray-500">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span>{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.class ? `${s.class.name} (${s.class.academicYear})` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.dob ? new Date(s.dob).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.bloodGroup ? (BLOOD_GROUP_ENUM_TO_DISPLAY[s.bloodGroup] ?? s.bloodGroup) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(s.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {!isTeacher && (
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Edit
                      </button>
                    )}
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
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Blood Group (optional)"
              options={bloodGroupOptions}
              placeholder="Select blood group"
              error={errors.bloodGroup?.message}
              {...register('bloodGroup')}
            />
            {!isTeacher && (
              <Select
                label="Caste (optional)"
                options={casteOptions}
                placeholder="Select caste"
                error={errors.caste?.message}
                {...register('caste')}
              />
            )}
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

      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title="Edit Student"
        size="lg"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Full Name" error={editErrors.name?.message} {...registerEdit('name')} />
            <Select
              label="Class"
              options={classOptions}
              placeholder="Select a class"
              error={editErrors.classId?.message}
              {...registerEdit('classId')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Birth" type="date" error={editErrors.dob?.message} {...registerEdit('dob')} />
            <Select
              label="Blood Group (optional)"
              options={bloodGroupOptions}
              placeholder="Select blood group"
              error={editErrors.bloodGroup?.message}
              {...registerEdit('bloodGroup')}
            />
          </div>
          {!isTeacher && (
            <Select
              label="Caste (optional)"
              options={casteOptions}
              placeholder="Select caste"
              error={editErrors.caste?.message}
              {...registerEdit('caste')}
            />
          )}
               <div className="border-t pt-4">
           <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Photo</p>
           <div className="flex items-center gap-4">
             <div className="h-14 w-14 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
               {editingStudent?.photoUrl ? (
                 <img src={editingStudent.photoUrl} alt={editingStudent.name} className="h-full w-full object-cover" />
               ) : (
                 <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-500">
                   {editingStudent?.name?.slice(0, 2).toUpperCase() ?? 'ST'}
                 </div>
               )}
             </div>
             <label className="flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
               <input
                 type="file"
                 accept="image/jpeg,image/png,image/webp"
                 className="hidden"
                 onChange={async (event) => {
                   const file = event.target.files?.[0];
                   if (!file) return;
                   try {
                     setUploadingPhoto(true);
                     await handleStudentPhotoUpload(file);
                   } catch (e) {
                     toast((e as Error).message, 'error');
                   } finally {
                     setUploadingPhoto(false);
                     event.target.value = '';
                   }
                 }}
               />
               {uploadingPhoto ? 'Uploading…' : 'Upload Photo'}
             </label>
           </div>
               </div>
               {editingStudent?.parents?.[0]?.parent && (
            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Parent / Guardian</p>
              <p className="mb-3 text-sm text-gray-600">
                {editingStudent.parents[0].parent.name}
                {editingStudent.parents[0].parent.phone ? ` · ${editingStudent.parents[0].parent.phone}` : ''}
              </p>
              <Input
                label="Profession (optional)"
                error={editErrors.parentProfession?.message}
                {...registerEdit('parentProfession')}
              />
            </div>
               )}
               <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingStudent(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={isEditSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
