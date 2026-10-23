'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDate, formatDateOnly } from '../../../lib/format';
import { getSession } from '../../../lib/auth';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { nameCaseWarning } from '../../../lib/names';

const BLOOD_GROUP_VALUES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const CASTE_VALUES = ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'] as const;
const GENDER_VALUES = ['male', 'female', 'other'] as const;

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
  rollNo?: string | null;
  dob: string | null;
  bloodGroup: string | null;
  gender?: (typeof GENDER_VALUES)[number] | null;
  caste: string | null;
  photoUrl?: string | null;
  classId: string;
  class?: { name: string; academicYear: string };
  parents?: Array<{ relation: string; isPrimary: boolean; parent: { id: string; name: string; phone: string | null; profession?: string | null } }>;
  customFieldValues?: Array<{ value: string; fieldDefinition: { id: string } }>;
  createdAt: string;
}

/** The school's own extra fields (e.g. SATS Number) — one column each; none for most schools. */
interface FieldDefinition {
  id: string;
  label: string;
}

interface Class {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
  _count?: { students: number };
}

function classLabel(c: Class) {
  return `${c.name}${c.section ? ` ${c.section}` : ''} (${c.academicYear})`;
}

const makeSchemas = (
  t: ReturnType<typeof useTranslations<'students'>>,
  tCommon: ReturnType<typeof useTranslations<'common'>>,
  /** The school numbers new students itself (Settings), so it may be left blank. */
  autoNumber = false,
) => ({
  create: z.object({
    name: z.string().min(1, tCommon('nameRequired')),
    admissionNo: autoNumber ? z.string().optional() : z.string().min(1, t('admissionRequired')),
    rollNo: z.string().max(20).optional(),
    dob: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
    gender: z.enum(GENDER_VALUES).optional(),
    caste: z.enum(CASTE_VALUES).optional(),
    classId: z.string().min(1, tCommon('classRequired')),
    parentPhone: z.string().min(10, t('invalidPhone')),
    parentRelation: z.enum(['father', 'mother', 'guardian']).optional(),
  }),
  edit: z.object({
    name: z.string().min(1, tCommon('nameRequired')),
    rollNo: z.string().max(20).optional(),
    classId: z.string().min(1, tCommon('classRequired')),
    dob: z.string().optional(),
    bloodGroup: z.enum(BLOOD_GROUP_VALUES).optional(),
    gender: z.enum(GENDER_VALUES).optional(),
    caste: z.enum(CASTE_VALUES).optional(),
    parentProfession: z.string().optional(),
  }),
});

type FormData = z.infer<ReturnType<typeof makeSchemas>['create']>;
type EditFormData = z.infer<ReturnType<typeof makeSchemas>['edit']>;

export default function StudentsPage() {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tCaste = useTranslations('caste');
  const tRelation = useTranslations('relation');
  const errorText = useErrorText();
  /** The number a student gets when the field is left blank (null: numbers are typed). */
  const [nextAdmission, setNextAdmission] = useState<string | null>(null);
  const schemas = useMemo(() => makeSchemas(t, tCommon, !!nextAdmission), [t, tCommon, nextAdmission]);
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  /** '' = all classes. Starts on the first class once classes load. */
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isTeacher = getSession()?.role === 'teacher';
  const [extraFields, setExtraFields] = useState<FieldDefinition[]>([]);

  useEffect(() => {
    api.get<FieldDefinition[]>('/custom-field-definitions').then(setExtraFields).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schemas.create) });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    control: editControl,
    formState: { errors: editErrors, isSubmitting: isEditSubmitting },
  } = useForm<EditFormData>({ resolver: zodResolver(schemas.edit) });
  const nameValue = useWatch({ control, name: 'name' });
  const editNameValue = useWatch({ control: editControl, name: 'name' });

  async function fetchStudents(q = search, classId = classFilter) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('search', q);
      if (classId) params.set('classId', classId);
      const studentRes = await api.get<{ data: Student[]; meta: { total: number } }>(`/students?${params}`);
      setStudents(studentRes.data);
      setTotal(studentRes.meta.total);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get<Class[]>('/classes')
      .then((res) => {
        // Newest year first, then Class 1, 2 … 10 in number order, then section.
        const sorted = [...res].sort(
          (a, b) =>
            b.academicYear.localeCompare(a.academicYear) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }) ||
            (a.section ?? '').localeCompare(b.section ?? ''),
        );
        setClasses(sorted);
        const first = sorted[0]?.id ?? '';
        setClassFilter(first);
        fetchStudents('', first);
      })
      .catch((e) => {
        setError(errorText(e));
        setLoading(false);
      });
  }, []);

  function changeClass(classId: string) {
    setClassFilter(classId);
    fetchStudents(search, classId);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    fetchStudents(search);
  }

  function openAdd() {
    // New students default to the class being viewed.
    reset({ classId: classFilter || '' } as Partial<FormData>);
    setShowModal(true);
    api
      .get<{ upcoming: string[] }>('/students/admission-numbering')
      .then((r) => setNextAdmission(r.upcoming[0] ?? null))
      .catch(() => setNextAdmission(null));
  }

  async function onSubmit(data: FormData) {
    try {
      await api.post('/students', {
        ...data,
        // Blank: the server gives the school's next number.
        admissionNo: data.admissionNo?.trim() || undefined,
        rollNo: data.rollNo?.trim() || undefined,
        dob: data.dob || undefined,
        bloodGroup: data.bloodGroup || undefined,
        gender: data.gender || undefined,
        caste: data.caste || undefined,
        parentRelation: data.parentRelation || undefined,
      });
      toast(t('added'), 'success');
      setShowModal(false);
      reset();
      fetchStudents();
    } catch (e) {
      toast(errorText(e), 'error');
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
      throw new Error((body as { message?: string })?.message ?? t('photoFailed'));
    }

    const uploaded = await uploadRes.json() as { key: string };
    const signed = await api.get<{ url: string }>(`/files/signed-url?key=${encodeURIComponent(uploaded.key)}`);
    // Save the key: the API signs a fresh URL on every read (a saved signed URL expires).
    await api.patch(`/students/${editingStudent.id}`, { photoUrl: uploaded.key });
    toast(t('photoUpdated'), 'success');
    fetchStudents();
    setEditingStudent((current) => current ? { ...current, photoUrl: signed.url } : current);
  }

  function openEdit(student: Student) {
    setEditingStudent(student);
    const primaryParent = student.parents?.[0]?.parent;
    resetEdit({
      name: student.name,
      rollNo: student.rollNo ?? '',
      classId: student.classId,
      dob: student.dob ? student.dob.slice(0, 10) : '',
      bloodGroup: student.bloodGroup
        ? (BLOOD_GROUP_ENUM_TO_DISPLAY[student.bloodGroup] as (typeof BLOOD_GROUP_VALUES)[number])
        : undefined,
      gender: student.gender ?? undefined,
      caste: (student.caste as (typeof CASTE_VALUES)[number]) || undefined,
      parentProfession: primaryParent?.profession ?? '',
    });
  }

  async function onEditSubmit(data: EditFormData) {
    if (!editingStudent) return;
    try {
      await api.patch(`/students/${editingStudent.id}`, {
        name: data.name,
        // "" clears the roll number
        rollNo: data.rollNo?.trim() ?? '',
        classId: data.classId,
        dob: data.dob || undefined,
        bloodGroup: data.bloodGroup || undefined,
        gender: data.gender || undefined,
        caste: data.caste || undefined,
      });

      const primaryParent = editingStudent.parents?.[0]?.parent;
      if (primaryParent && data.parentProfession !== undefined) {
        await api.patch(`/users/${primaryParent.id}`, {
          profession: data.parentProfession || undefined,
        });
      }

      toast(t('updated'), 'success');
      setEditingStudent(null);
      fetchStudents();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: classLabel(c),
  }));
  const classFilterOptions = [
    ...classes.map((c) => ({
      value: c.id,
      label: c._count ? t('classOption', { name: classLabel(c), count: c._count.students }) : classLabel(c),
    })),
    { value: '', label: t('allClasses') },
  ];

  const relationOptions = (['father', 'mother', 'guardian'] as const).map((value) => ({ value, label: tRelation(value) }));

  const bloodGroupOptions = BLOOD_GROUP_VALUES.map((v) => ({ value: v, label: v }));
  const genderOptions = GENDER_VALUES.map((v) => ({ value: v, label: t(`gender_${v}`) }));
  const casteOptions = CASTE_VALUES.map((v) => ({ value: v, label: tCaste(v) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="w-full sm:w-80">
            <Select
              id="student-class-filter"
              aria-label={t('classFilter')}
              options={classFilterOptions}
              value={classFilter ?? ''}
              onChange={(e) => changeClass(e.target.value)}
              disabled={classFilter === null}
              className="!py-1.5"
            />
          </div>
          <form onSubmit={handleSearch} className="flex w-full gap-2 sm:w-auto">
            <input
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="secondary" size="sm" type="submit">{tCommon('searchButton')}</Button>
          </form>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{t('count', { count: total })}</span>
          <Button onClick={openAdd}>{t('add')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : students.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          action={<Button onClick={openAdd}>{t('add')}</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colAdmissionNo'), t('colName'), t('colParent'), t('colClass'), ...extraFields.map((f) => f.label), t('colDob'), t('colBloodGroup'), t('colEnrolled'), ''].map((h, i) => (
                  <th key={i} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-gray-700">{s.admissionNo}</td>
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
                      <Link href={`/admin/students/${s.id}`} className="whitespace-nowrap text-teal hover:underline">
                        {s.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.parents?.length ? (
                      <div className="flex flex-col gap-0.5">
                        {[...s.parents]
                          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
                          .map(({ parent, relation }) => (
                            <Link key={parent.id} href={`/admin/users/${parent.id}`} className="whitespace-nowrap text-teal hover:underline">
                              {parent.name}
                              {(['father', 'mother', 'guardian'] as const).some((r) => r === relation) && (
                                <span className="text-xs text-gray-500">
                                  {' '}
                                  · {tRelation(relation as 'father' | 'mother' | 'guardian')}
                                </span>
                              )}
                            </Link>
                          ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {(() => {
                      const cls = classes.find((c) => c.id === s.classId);
                      return cls ? classLabel(cls) : s.class ? `${s.class.name} (${s.class.academicYear})` : '—';
                    })()}
                  </td>
                  {extraFields.map((f) => (
                    <td key={f.id} className="px-6 py-4 text-sm font-mono text-gray-700">
                      {s.customFieldValues?.find((v) => v.fieldDefinition.id === f.id)?.value || '—'}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.dob ? formatDateOnly(s.dob) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.bloodGroup ? (BLOOD_GROUP_ENUM_TO_DISPLAY[s.bloodGroup] ?? s.bloodGroup) : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(s.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {!isTeacher && (
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="text-teal hover:text-coral-dark font-medium"
                      >
                        {tCommon('edit')}
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
        title={t('addTitle')}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('fullName')} required error={errors.name?.message} warning={nameCaseWarning(nameValue, tCommon('nameLowercaseWarning'))} {...register('name')} />
            <Input
              label={t('admissionNo')}
              required={!nextAdmission}
              placeholder={nextAdmission ?? undefined}
              helpText={nextAdmission ? t('admissionAuto', { next: nextAdmission }) : undefined}
              error={errors.admissionNo?.message}
              {...register('admissionNo')}
            />
            <Input label={t('rollNo')} placeholder={t('rollNoPlaceholder')} error={errors.rollNo?.message} {...register('rollNo')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('dob')} type="date" error={errors.dob?.message} {...register('dob')} />
            <Select
              label={t('class')} required
              options={classOptions}
              placeholder={tCommon('selectClass')}
              error={errors.classId?.message}
              {...register('classId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t('gender')}
              options={genderOptions}
              placeholder={t('selectGender')}
              error={errors.gender?.message}
              {...register('gender')}
            />
            <Select
              label={t('bloodGroup')}
              options={bloodGroupOptions}
              placeholder={t('selectBloodGroup')}
              error={errors.bloodGroup?.message}
              {...register('bloodGroup')}
            />
            {!isTeacher && (
              <Select
                label={t('caste')}
                options={casteOptions}
                placeholder={t('selectCaste')}
                error={errors.caste?.message}
                {...register('caste')}
              />
            )}
          </div>
          <div className="border-t pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('parentSection')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label={t('parentPhone')} required placeholder={t('phonePlaceholder')} error={errors.parentPhone?.message} {...register('parentPhone')} />
              <Select
                label={t('relation')}
                options={relationOptions}
                placeholder={t('selectRelation')}
                error={errors.parentRelation?.message}
                {...register('parentRelation')}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); reset(); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t('submitAdd')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        title={t('editTitle')}
        size="lg"
      >
        <form onSubmit={handleEditSubmit(onEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('fullName')} required error={editErrors.name?.message} warning={nameCaseWarning(editNameValue, tCommon('nameLowercaseWarning'))} {...registerEdit('name')} />
            <Input label={t('rollNo')} placeholder={t('rollNoPlaceholder')} error={editErrors.rollNo?.message} {...registerEdit('rollNo')} />
            <Select
              label={t('class')} required
              options={classOptions}
              placeholder={tCommon('selectClass')}
              error={editErrors.classId?.message}
              {...registerEdit('classId')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('dob')} type="date" error={editErrors.dob?.message} {...registerEdit('dob')} />
            <Select
              label={t('bloodGroup')}
              options={bloodGroupOptions}
              placeholder={t('selectBloodGroup')}
              error={editErrors.bloodGroup?.message}
              {...registerEdit('bloodGroup')}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t('gender')}
              options={genderOptions}
              placeholder={t('selectGender')}
              error={editErrors.gender?.message}
              {...registerEdit('gender')}
            />
            {!isTeacher && (
              <Select
                label={t('caste')}
                options={casteOptions}
                placeholder={t('selectCaste')}
                error={editErrors.caste?.message}
                {...registerEdit('caste')}
              />
            )}
          </div>
               <div className="border-t pt-4">
           <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('photo')}</p>
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
                     toast(errorText(e, (e as Error).message), 'error');
                   } finally {
                     setUploadingPhoto(false);
                     event.target.value = '';
                   }
                 }}
               />
               {uploadingPhoto ? tCommon('uploading') : t('uploadPhoto')}
             </label>
           </div>
               </div>
               {editingStudent?.parents?.[0]?.parent && (
            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('parentSection')}</p>
              <p className="mb-3 text-sm text-gray-600">
                {editingStudent.parents[0].parent.name}
                {editingStudent.parents[0].parent.phone ? ` · ${editingStudent.parents[0].parent.phone}` : ''}
              </p>
              <Input
                label={t('profession')}
                error={editErrors.parentProfession?.message}
                {...registerEdit('parentProfession')}
              />
            </div>
               )}
               <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditingStudent(null)}>
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
