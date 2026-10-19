'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { weekdayName } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';
import { PlanGate } from '../../../components/plan-gate';
import { getSession } from '../../../lib/auth';
import Link from 'next/link';

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

/** Mon–Sat (1 = Monday); labels come from the UI language. */
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function classLabel(c: SchoolClass): string {
  const section = c.section ? ` (${c.section})` : '';
  return `${c.name}${section} · ${c.academicYear}`;
}

export default function TimetablePage() {
  return (
    <PlanGate feature="timetable">
      <TimetablePageContent />
    </PlanGate>
  );
}

function TimetablePageContent() {
  const t = useTranslations('timetable');
  const tCommon = useTranslations('common');
  const tTimings = useTranslations('periodTimings');
  const locale = useLocale();
  const errorText = useErrorText();
  const DAYS = DAY_NUMBERS.map((value) => ({ value, label: weekdayName(value, locale, 'short') }));
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
      setError(errorText(e));
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
      setError(errorText(e));
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
  // Who may teach what in THIS class, from the teacher assignments (TeacherSubject).
  const classAssignments = teachers.flatMap((teacher) =>
    teacher.taughtSubjects
      .filter((ts) => ts.class.id === selectedClassId)
      .map((ts) => ({ teacherId: teacher.id, subjectId: ts.subject.id })),
  );
  const teacherCanTeach = (teacherId: string, subjectId: string) =>
    classAssignments.some((a) => a.teacherId === teacherId && a.subjectId === subjectId);
  // Subjects offered: only those assigned in this class (and, once a teacher is picked, only theirs).
  const subjectChoices = subjects.filter((s) =>
    classAssignments.some((a) => a.subjectId === s.id && (!formTeacherId || a.teacherId === formTeacherId)),
  );
  // Teachers offered: only those assigned the chosen subject in this class.
  const teacherChoices = teachers.filter((teacher) =>
    classAssignments.some((a) => a.teacherId === teacher.id && (!formSubjectId || a.subjectId === formSubjectId)),
  );
  const teacherOptions = teacherChoices.map((teacher) => ({ value: teacher.id, label: teacher.name }));
  const subjectOptions = subjectChoices.map((s) => ({ value: s.id, label: s.name }));
  // A slot saved before this rule may hold a pair that is no longer offered: keep it visible so it can be fixed.
  if (formTeacherId && !teacherOptions.some((o) => o.value === formTeacherId)) {
    const current = teachers.find((teacher) => teacher.id === formTeacherId);
    if (current) teacherOptions.push({ value: current.id, label: current.name });
  }
  if (formSubjectId && !subjectOptions.some((o) => o.value === formSubjectId)) {
    const current = subjects.find((s) => s.id === formSubjectId);
    if (current) subjectOptions.push({ value: current.id, label: current.name });
  }

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
      toast(t('selectBoth'), 'error');
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
      toast(t('slotSaved'), 'success');
      closeCell();
      fetchGrid(selectedClassId);
    } catch (e) {
      toast(errorText(e), 'error');
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
      toast(t('slotRemoved'), 'success');
      closeCell();
      fetchGrid(selectedClassId);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRemoving(false);
    }
  }

  const activeSlot = activeCell ? slotFor(activeCell.dayOfWeek, activeCell.periodNumber) : undefined;
  const activeDayLabel = activeCell ? DAYS.find((d) => d.value === activeCell.dayOfWeek)?.label : '';

  // Addendum — soft, non-blocking check: warn (don't prevent saving) when the
  // selected teacher has no TeacherSubject assignment matching this subject
  // + class, e.g. a substitute being slotted in ad hoc is still allowed.
  const selectedTeacher = teachers.find((teacher) => teacher.id === formTeacherId);
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
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>
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
        />
      ) : (
        <div className="space-y-4">
          <div className="max-w-xs">
            <Select
              label={t('class')}
              options={classOptions}
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            />
          </div>

          {gridLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner className="h-8 w-8 text-teal" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cream/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                      {t('period')}
                    </th>
                    {DAYS.map((d) => (
                      <th
                        key={d.value}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80"
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
                                  ? 'border-teal/30 bg-teal/5 hover:bg-teal/20'
                                  : 'border-dashed border-gray-300 text-gray-400 hover:border-teal/30 hover:text-coral-dark'
                              }`}
                            >
                              {slot ? (
                                <>
                                  <div className="font-semibold text-gray-900">{slot.subject.name}</div>
                                  <div className="text-gray-500">{slot.teacher.name}</div>
                                </>
                              ) : (
                                t('addSlot')
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

      {getSession()?.role === 'admin' && (
        <p className="text-sm text-gray-500">
          {tTimings('movedToSettings')}{' '}
          <Link href="/admin/settings" className="font-semibold text-teal hover:underline">
            {tTimings('openSettings')}
          </Link>
        </p>
      )}

      <Modal
        open={!!activeCell}
        onClose={closeCell}
        title={activeCell ? t('cellTitle', { day: activeDayLabel ?? '', n: activeCell.periodNumber }) : ''}
      >
        <div className="space-y-4">
          {classAssignments.length === 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {t('noAssignments', { className: selectedClassLabel ? classLabel(selectedClassLabel) : t('thisClass') })}
            </div>
          )}
          <Select
            label={t('subject')} required
            options={subjectOptions}
            placeholder={t('selectSubject')}
            value={formSubjectId}
            onChange={(e) => {
              const subjectId = e.target.value;
              setFormSubjectId(subjectId);
              if (formTeacherId && subjectId && !teacherCanTeach(formTeacherId, subjectId)) setFormTeacherId('');
            }}
          />
          <Select
            label={t('teacher')} required
            options={teacherOptions}
            placeholder={t('selectTeacher')}
            value={formTeacherId}
            onChange={(e) => {
              const teacherId = e.target.value;
              setFormTeacherId(teacherId);
              if (formSubjectId && teacherId && !teacherCanTeach(teacherId, formSubjectId)) setFormSubjectId('');
            }}
          />
          {isMismatch && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {t('mismatch', {
                teacher: selectedTeacher?.name ?? '',
                subject: selectedSubjectName ?? '',
                className: selectedClassLabel ? classLabel(selectedClassLabel) : t('thisClass'),
              })}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 pt-2">
            {activeSlot ? (
              <Button variant="danger" type="button" loading={removing} onClick={onRemoveCell}>
                {t('remove')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button variant="secondary" type="button" onClick={closeCell}>
                {tCommon('cancel')}
              </Button>
              <Button type="button" loading={saving} onClick={onSaveCell}>
                {tCommon('save')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
