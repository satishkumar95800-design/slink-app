'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

interface SchoolClass {
  id: string;
  name: string;
  section: string | null;
  academicYear: string;
  teachers: Array<{ isClassTeacher: boolean; teacher: { id: string; name: string } }>;
  _count?: { students: number };
}

interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  taughtSubjects: Array<{
    subject: { id: string; name: string };
    class: { id: string; name: string; section: string | null; academicYear: string };
  }>;
}

interface Subject {
  id: string;
  name: string;
  tenantId: string;
  createdAt: string;
}

interface TimetableSlot {
  id: string;
  dayOfWeek: number;
  periodNumber: number;
  teacher: { id: string; name: string };
  subject: { id: string; name: string };
  class: { id: string; name: string; section: string | null; academicYear: string };
}

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function classLabel(c: SchoolClass): string {
  const section = c.section ? ` (${c.section})` : '';
  return `${c.name}${section} · ${c.academicYear}`;
}

export default function TimetablePage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeCell, setActiveCell] = useState<{ dayOfWeek: number; periodNumber: number } | null>(null);
  const [formTeacherId, setFormTeacherId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function fetchInitial() {
    try {
      setLoading(true);
      const [classRes, teacherRes, subjectRes] = await Promise.all([
        api.get<SchoolClass[]>('/classes'),
        api.get<Teacher[]>('/teachers'),
        api.get<Subject[]>('/subjects'),
      ]);
      setClasses(classRes);
      setTeachers(teacherRes);
      setSubjects(subjectRes);
      setError(null);
      if (classRes.length > 0) setSelectedClassId(classRes[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGrid(classId: string) {
    if (!classId) {
      setSlots([]);
      return;
    }
    try {
      setGridLoading(true);
      const res = await api.get<TimetableSlot[]>(`/timetable?classId=${classId}`);
      setSlots(res);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGridLoading(false);
    }
  }

  useEffect(() => {
    fetchInitial();
  }, []);

  useEffect(() => {
    if (selectedClassId) fetchGrid(selectedClassId);
  }, [selectedClassId]);

  const classOptions = classes.map((c) => ({ value: c.id, label: classLabel(c) }));
  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.name }));
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));

  function slotFor(dayOfWeek: number, periodNumber: number): TimetableSlot | undefined {
    return slots.find((s) => s.dayOfWeek === dayOfWeek && s.periodNumber === periodNumber);
  }

  function openCell(dayOfWeek: number, periodNumber: number) {
    const existing = slotFor(dayOfWeek, periodNumber);
    setActiveCell({ dayOfWeek, periodNumber });
    setFormTeacherId(existing?.teacher.id ?? '');
    setFormSubjectId(existing?.subject.id ?? '');
  }

  function closeCell() {
    setActiveCell(null);
    setFormTeacherId('');
    setFormSubjectId('');
  }

  async function onSaveCell() {
    if (!activeCell || !selectedClassId) return;
    if (!formTeacherId || !formSubjectId) {
      toast('Select both a subject and a teacher', 'error');
      return;
    }
    try {
      setSaving(true);
      await api.post('/timetable', {
        classId: selectedClassId,
        teacherId: formTeacherId,
        subjectId: formSubjectId,
        dayOfWeek: activeCell.dayOfWeek,
        periodNumber: activeCell.periodNumber,
      });
      toast('Timetable slot saved', 'success');
      closeCell();
      fetchGrid(selectedClassId);
    } catch (e) {
      toast((e as ApiError).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveCell() {
    if (!activeCell || !selectedClassId) return;
    const existing = slotFor(activeCell.dayOfWeek, activeCell.periodNumber);
    if (!existing) return;
    try {
      setRemoving(true);
      await api.delete(`/timetable/${existing.id}`);
      toast('Timetable slot removed', 'success');
      closeCell();
      fetchGrid(selectedClassId);
    } catch (e) {
      toast((e as ApiError).message, 'error');
    } finally {
      setRemoving(false);
    }
  }

  const activeSlot = activeCell ? slotFor(activeCell.dayOfWeek, activeCell.periodNumber) : undefined;
  const activeDayLabel = activeCell ? DAYS.find((d) => d.value === activeCell.dayOfWeek)?.label : '';

  // Addendum — soft, non-blocking check: warn (don't prevent saving) when the
  // selected teacher has no TeacherSubject assignment matching this subject
  // + class, e.g. a substitute being slotted in ad hoc is still allowed.
  const selectedTeacher = teachers.find((t) => t.id === formTeacherId);
  const isMismatch = Boolean(
    formTeacherId &&
      formSubjectId &&
      selectedClassId &&
      !selectedTeacher?.taughtSubjects.some(
        (ts) => ts.subject.id === formSubjectId && ts.class.id === selectedClassId,
      ),
  );
  const selectedSubjectName = subjects.find((s) => s.id === formSubjectId)?.name;
  const selectedClassLabel = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Timetable</h1>
          <p className="text-sm text-gray-500">
            Manage the weekly period grid — which teacher teaches which subject, and when.
          </p>
        </div>
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
          description="Create a class first before building its timetable."
        />
      ) : (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Select
              label="Class"
              options={classOptions}
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            />
          </div>

          {gridLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-8 w-8 text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Period
                    </th>
                    {DAYS.map((d) => (
                      <th
                        key={d.value}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {PERIODS.map((period) => (
                    <tr key={period} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{period}</td>
                      {DAYS.map((d) => {
                        const slot = slotFor(d.value, period);
                        return (
                          <td key={d.value} className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => openCell(d.value, period)}
                              className={`block w-full min-w-[110px] rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                slot
                                  ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                                  : 'border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600'
                              }`}
                            >
                              {slot ? (
                                <>
                                  <div className="font-semibold text-gray-900">{slot.subject.name}</div>
                                  <div className="text-gray-500">{slot.teacher.name}</div>
                                </>
                              ) : (
                                '+ Add'
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal
        open={!!activeCell}
        onClose={closeCell}
        title={activeCell ? `${activeDayLabel} · Period ${activeCell.periodNumber}` : ''}
      >
        <div className="space-y-4">
          <Select
            label="Subject"
            options={subjectOptions}
            placeholder="Select a subject"
            value={formSubjectId}
            onChange={(e) => setFormSubjectId(e.target.value)}
          />
          <Select
            label="Teacher"
            options={teacherOptions}
            placeholder="Select a teacher"
            value={formTeacherId}
            onChange={(e) => setFormTeacherId(e.target.value)}
          />
          {isMismatch && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              ⚠ {selectedTeacher?.name} is not assigned to teach {selectedSubjectName} for{' '}
              {selectedClassLabel ? classLabel(selectedClassLabel) : 'this class'} — you can still
              save this slot.
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-2">
            {activeSlot ? (
              <Button variant="danger" type="button" loading={removing} onClick={onRemoveCell}>
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={closeCell}>
                Cancel
              </Button>
              <Button type="button" loading={saving} onClick={onSaveCell}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
