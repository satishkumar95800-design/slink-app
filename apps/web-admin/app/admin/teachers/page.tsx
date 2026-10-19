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
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

interface ClassRef {
  id: string;
  name: string;
  section: string | null;
  academicYear: string;
}

interface Teacher {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taughtClasses: Array<{ isClassTeacher: boolean; class: ClassRef }>;
  taughtSubjects: Array<{ id: string; subject: { id: string; name: string }; class: ClassRef }>;
}

interface Subject {
  id: string;
  name: string;
}

const makeSchemas = (t: ReturnType<typeof useTranslations<'teachers'>>, tCommon: ReturnType<typeof useTranslations<'common'>>) => ({
  assign: z.object({
    subjectId: z.string().min(1, t('selectSubject')),
    classIds: z.array(z.string()).min(1, tCommon('selectClass')),
  }),
  subject: z.object({
    name: z.string().min(1, t('subjectNameRequired')),
  }),
});

type AssignFormData = z.infer<ReturnType<typeof makeSchemas>['assign']>;
type SubjectFormData = z.infer<ReturnType<typeof makeSchemas>['subject']>;

function classLabel(c: ClassRef): string {
  return `${c.name}${c.section ? ` ${c.section}` : ''} (${c.academicYear})`;
}

export default function TeachersPage() {
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const schemas = useMemo(() => makeSchemas(t, tCommon), [t, tCommon]);
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const {
    register: registerAssign,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    watch: watchAssign,
    setValue: setAssignValue,
    formState: { errors: assignErrors, isSubmitting: isAssignSubmitting },
  } = useForm<AssignFormData>({
    resolver: zodResolver(schemas.assign),
    defaultValues: { subjectId: '', classIds: [] },
  });

  const {
    register: registerSubject,
    handleSubmit: handleSubjectSubmit,
    reset: resetSubject,
    formState: { errors: subjectErrors, isSubmitting: isSubjectSubmitting },
  } = useForm<SubjectFormData>({ resolver: zodResolver(schemas.subject) });

  async function fetchAll() {
    try {
      setLoading(true);
      const [teacherRes, subjectRes, classRes] = await Promise.all([
        api.get<Teacher[]>('/teachers'),
        api.get<Subject[]>('/subjects'),
        api.get<ClassRef[]>('/classes'),
      ]);
      setTeachers(teacherRes);
      setSubjects(subjectRes);
      setClasses(classRes);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const assignSubjectId = watchAssign('subjectId');
  const assignClassIds = watchAssign('classIds') ?? [];
  // Classes this teacher already teaches the chosen subject in: shown, but can't be picked again.
  const takenClassIds = new Set(
    (assigningTeacher?.taughtSubjects ?? [])
      .filter((ts) => ts.subject.id === assignSubjectId)
      .map((ts) => ts.class.id),
  );

  function toggleAssignClass(classId: string, checked: boolean) {
    const next = checked ? [...assignClassIds, classId] : assignClassIds.filter((id) => id !== classId);
    setAssignValue('classIds', next, { shouldValidate: true });
  }

  function openAssign(teacher: Teacher) {
    setAssigningTeacher(teacher);
    resetAssign({ subjectId: '', classIds: [] });
  }

  async function onAssignSubmit(data: AssignFormData) {
    if (!assigningTeacher) return;
    try {
      await api.post(`/teachers/${assigningTeacher.id}/subjects/bulk`, data);
      toast(t('assignmentAdded'), 'success');
      setAssigningTeacher(null);
      fetchAll();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function onSubjectSubmit(data: SubjectFormData) {
    try {
      await api.post('/subjects', data);
      toast(t('subjectAdded'), 'success');
      setShowSubjectModal(false);
      resetSubject();
      fetchAll();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function handleRemoveAssignment(teacherId: string, assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      await api.delete(`/teachers/${teacherId}/subjects/${assignmentId}`);
      toast(t('assignmentRemoved'), 'success');
      fetchAll();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRemovingId(null);
    }
  }

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  // Newest year first, then Class 1, 2 … 10 in number order, then section.
  const sortedClassOptions = [...classes]
    .sort(
      (a, b) =>
        b.academicYear.localeCompare(a.academicYear) ||
        a.name.localeCompare(b.name, undefined, { numeric: true }) ||
        (a.section ?? '').localeCompare(b.section ?? ''),
    )
    .map((c) => ({ value: c.id, label: classLabel(c) }));
  const sortedSubjectOptions = [...subjectOptions].sort((a, b) => a.label.localeCompare(b.label));

  // Subject: teaches it in any class. Class: teaches any subject there or is its
  // class teacher. Both: teaches that subject in that class.
  const filtering = !!subjectFilter || !!classFilter;
  const visibleTeachers = teachers.filter((teacher) => {
    if (subjectFilter) {
      return teacher.taughtSubjects.some(
        (a) => a.subject.id === subjectFilter && (!classFilter || a.class.id === classFilter),
      );
    }
    if (classFilter) {
      return (
        teacher.taughtSubjects.some((a) => a.class.id === classFilter) ||
        teacher.taughtClasses.some((c) => c.isClassTeacher && c.class.id === classFilter)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="w-full sm:w-56">
            <Select
              id="teacher-subject-filter"
              aria-label={t('filterSubject')}
              options={sortedSubjectOptions}
              placeholder={t('allSubjects')}
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="!py-1.5"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              id="teacher-class-filter"
              aria-label={t('filterClass')}
              options={sortedClassOptions}
              placeholder={t('allClasses')}
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="!py-1.5"
            />
          </div>
          {filtering && (
            <button
              type="button"
              onClick={() => {
                setSubjectFilter('');
                setClassFilter('');
              }}
              className="text-xs text-teal hover:underline"
            >
              {t('clearFilters')}
            </button>
          )}
          <p className="text-sm text-gray-500">
            {filtering
              ? t('countFiltered', { shown: visibleTeachers.length, count: teachers.length })
              : t('count', { count: teachers.length })}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowSubjectModal(true)}>
          {t('addSubject')}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : teachers.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : visibleTeachers.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center text-sm text-gray-500 shadow-sm">
          {t('noMatches')}
        </p>
      ) : (
        <div className="space-y-3">
          {visibleTeachers.map((teacher) => (
            <div key={teacher.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                  <p className="text-xs text-gray-500">{teacher.phone ?? '—'} · {teacher.email ?? '—'}</p>
                </div>
                <button
                  onClick={() => openAssign(teacher)}
                  className="text-xs text-teal hover:underline"
                >
                  {t('assignSubjectClass')}
                </button>
              </div>

              {teacher.taughtClasses.some((c) => c.isClassTeacher) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {teacher.taughtClasses
                    .filter((c) => c.isClassTeacher)
                    .map((c) => (
                      <Badge key={c.class.id} variant="green">
                        {t('classTeacherOf', { className: classLabel(c.class) })}
                      </Badge>
                    ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {teacher.taughtSubjects.length === 0 ? (
                  <span className="text-xs text-gray-400">{t('noAssignments')}</span>
                ) : (
                  teacher.taughtSubjects.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {t('assignmentChip', { subject: a.subject.name, className: classLabel(a.class) })}
                      <button
                        onClick={() => handleRemoveAssignment(teacher.id, a.id)}
                        disabled={removingId === a.id}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        aria-label={t('removeAssignment', { subject: a.subject.name })}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!assigningTeacher}
        onClose={() => setAssigningTeacher(null)}
        title={t('assignTitle', { name: assigningTeacher?.name ?? '' })}
      >
        <form onSubmit={handleAssignSubmit(onAssignSubmit)} className="space-y-4">
          <Select
            label={t('subject')} required
            options={subjectOptions}
            placeholder={t('selectSubject')}
            error={assignErrors.subjectId?.message}
            {...registerAssign('subjectId')}
          />
          <fieldset className="space-y-1.5">
            <legend className="mb-1 block text-sm font-medium text-gray-700">
              {t('classesLabel')}<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
            </legend>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
              {sortedClassOptions.map((c) => {
                const taken = takenClassIds.has(c.value);
                return (
                  <label
                    key={c.value}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${taken ? 'text-gray-400' : 'text-gray-800 hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal"
                      disabled={taken}
                      checked={assignClassIds.includes(c.value)}
                      onChange={(e) => toggleAssignClass(c.value, e.target.checked)}
                    />
                    <span>{c.label}</span>
                    {taken && <span className="ml-auto text-xs">{t('alreadyAssigned')}</span>}
                  </label>
                );
              })}
            </div>
            {assignErrors.classIds && <p className="text-xs text-red-600">{assignErrors.classIds.message}</p>}
          </fieldset>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAssigningTeacher(null)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isAssignSubmitting}>
              {t('assign')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); resetSubject(); }}
        title={t('addSubjectTitle')}
      >
        <form onSubmit={handleSubjectSubmit(onSubjectSubmit)} className="space-y-4">
          <Input
            label={t('subjectName')} required
            placeholder={t('subjectNamePlaceholder')}
            error={subjectErrors.name?.message}
            {...registerSubject('name')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowSubjectModal(false); resetSubject(); }}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={isSubjectSubmitting}>
              {t('addSubjectSubmit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
