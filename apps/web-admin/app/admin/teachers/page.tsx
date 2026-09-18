'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
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

const assignSchema = z.object({
  subjectId: z.string().min(1, 'Select a subject'),
  classId: z.string().min(1, 'Select a class'),
});

type AssignFormData = z.infer<typeof assignSchema>;

const subjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
});

type SubjectFormData = z.infer<typeof subjectSchema>;

function classLabel(c: ClassRef): string {
  return `${c.name}${c.section ? ` ${c.section}` : ''} (${c.academicYear})`;
}

export default function TeachersPage() {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const {
    register: registerAssign,
    handleSubmit: handleAssignSubmit,
    reset: resetAssign,
    formState: { errors: assignErrors, isSubmitting: isAssignSubmitting },
  } = useForm<AssignFormData>({ resolver: zodResolver(assignSchema) });

  const {
    register: registerSubject,
    handleSubmit: handleSubjectSubmit,
    reset: resetSubject,
    formState: { errors: subjectErrors, isSubmitting: isSubjectSubmitting },
  } = useForm<SubjectFormData>({ resolver: zodResolver(subjectSchema) });

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
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function openAssign(teacher: Teacher) {
    setAssigningTeacher(teacher);
    resetAssign({ subjectId: '', classId: '' });
  }

  async function onAssignSubmit(data: AssignFormData) {
    if (!assigningTeacher) return;
    try {
      await api.post(`/teachers/${assigningTeacher.id}/subjects`, data);
      toast('Subject assignment added', 'success');
      setAssigningTeacher(null);
      fetchAll();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  async function onSubjectSubmit(data: SubjectFormData) {
    try {
      await api.post('/subjects', data);
      toast('Subject added', 'success');
      setShowSubjectModal(false);
      resetSubject();
      fetchAll();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    }
  }

  async function handleRemoveAssignment(teacherId: string, assignmentId: string) {
    setRemovingId(assignmentId);
    try {
      await api.delete(`/teachers/${teacherId}/subjects/${assignmentId}`);
      toast('Assignment removed', 'success');
      fetchAll();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const classOptions = classes.map((c) => ({ value: c.id, label: classLabel(c) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {teachers.length} teacher{teachers.length !== 1 ? 's' : ''}
        </p>
        <Button variant="secondary" onClick={() => setShowSubjectModal(true)}>
          + Add Subject
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-blue-600" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : teachers.length === 0 ? (
        <EmptyState
          title="No teachers yet"
          description="Add teacher accounts from the Users page, then assign subjects and classes here."
        />
      ) : (
        <div className="space-y-3">
          {teachers.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.phone ?? '—'} · {t.email ?? '—'}</p>
                </div>
                <button
                  onClick={() => openAssign(t)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Assign subject/class
                </button>
              </div>

              {t.taughtClasses.some((c) => c.isClassTeacher) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {t.taughtClasses
                    .filter((c) => c.isClassTeacher)
                    .map((c) => (
                      <Badge key={c.class.id} variant="green">
                        Class teacher — {classLabel(c.class)}
                      </Badge>
                    ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.taughtSubjects.length === 0 ? (
                  <span className="text-xs text-gray-400">No subject assignments</span>
                ) : (
                  t.taughtSubjects.map((a) => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {a.subject.name} — {classLabel(a.class)}
                      <button
                        onClick={() => handleRemoveAssignment(t.id, a.id)}
                        disabled={removingId === a.id}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${a.subject.name} assignment`}
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
        title={`Assign Subject — ${assigningTeacher?.name ?? ''}`}
      >
        <form onSubmit={handleAssignSubmit(onAssignSubmit)} className="space-y-4">
          <Select
            label="Subject"
            options={subjectOptions}
            placeholder="Select a subject"
            error={assignErrors.subjectId?.message}
            {...registerAssign('subjectId')}
          />
          <Select
            label="Class"
            options={classOptions}
            placeholder="Select a class"
            error={assignErrors.classId?.message}
            {...registerAssign('classId')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAssigningTeacher(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={isAssignSubmitting}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showSubjectModal}
        onClose={() => { setShowSubjectModal(false); resetSubject(); }}
        title="Add Subject"
      >
        <form onSubmit={handleSubjectSubmit(onSubjectSubmit)} className="space-y-4">
          <Input
            label="Subject Name"
            placeholder="e.g. Mathematics"
            error={subjectErrors.name?.message}
            {...registerSubject('name')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowSubjectModal(false); resetSubject(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubjectSubmitting}>
              Add Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
