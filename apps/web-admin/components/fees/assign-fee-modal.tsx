'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { classLabel, compareClasses, compareTerms, termOf, type ClassRef } from '../../lib/fee-terms';
import { formatDateOnly, formatRupees } from '../../lib/format';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { Select } from '../ui/select';
import { Spinner } from '../ui/spinner';

interface ClassWithCount extends ClassRef {
  _count?: { students: number };
}

interface FeePlan {
  id: string;
  name: string;
  totalAmount: number;
  dueDate: string;
  academicYear: string;
  classes?: Array<{ class: ClassRef }>;
}

interface StudentRef {
  id: string;
  name: string;
  admissionNo: string;
}

type Scope = 'student' | 'class' | 'school';

/** One class in the assignment, with the plan found for it (or why there is none). */
interface Target {
  cls: ClassWithCount;
  plan: FeePlan | null;
  /** More than one plan matched this class, term and year. */
  ambiguous: boolean;
}

interface Outcome {
  assigned: number;
  alreadyHad: number;
  failed: Array<{ label: string; reason: string }>;
}

/**
 * Assign a term's fee to one student, one class or the whole school. The plan
 * is looked up per class for the chosen term and year; a class without one is
 * shown and skipped, never assigned some other plan.
 */
export function AssignFeeModal({ open, onClose, onAssigned }: { open: boolean; onClose: () => void; onAssigned: () => void }) {
  const t = useTranslations('assignFee');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [classes, setClasses] = useState<ClassWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('class');
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('');
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [studentId, setStudentId] = useState('');
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([api.get<FeePlan[]>('/fee-structures'), api.get<ClassWithCount[]>('/classes')])
      .then(([planRes, classRes]) => {
        if (cancelled) return;
        setPlans(planRes);
        setClasses([...classRes].sort(compareClasses));
        // Default to the newest year and its current term: the first one not yet due, else the last.
        const years = [...new Set(planRes.map((p) => p.academicYear))].sort().reverse();
        const y = years[0] ?? '';
        setYear(y);
        setTerm(currentTerm(planRes.filter((p) => p.academicYear === y)));
        setLoadError(null);
      })
      .catch((e) => !cancelled && setLoadError(errorText(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setScope('class');
    setClassId('');
    setStudentId('');
    setStudents([]);
    setOutcome(null);
    setLoading(true);
  }

  function close() {
    if (running) return;
    if (outcome && outcome.assigned > 0) onAssigned();
    reset();
    onClose();
  }

  function pickClass(id: string) {
    setClassId(id);
    setStudentId('');
    setStudents([]);
    if (scope === 'student' && id) {
      api
        .get<{ data: StudentRef[] }>(`/students?classId=${id}&limit=100`)
        .then((res) => setStudents(res.data))
        .catch(() => setStudents([]));
    }
  }

  function pickScope(next: Scope) {
    setScope(next);
    setOutcome(null);
    setStudentId('');
    if (next === 'student' && classId) {
      api
        .get<{ data: StudentRef[] }>(`/students?classId=${classId}&limit=100`)
        .then((res) => setStudents(res.data))
        .catch(() => setStudents([]));
    }
  }

  const yearOptions = [...new Set(plans.map((p) => p.academicYear))]
    .sort()
    .reverse()
    .map((y) => ({ value: y, label: y }));
  const termOptions = [...new Set(plans.filter((p) => p.academicYear === year).map(termOf))]
    .sort(compareTerms)
    .map((x) => ({ value: x, label: x }));
  const classOptions = classes.map((c) => ({ value: c.id, label: `${classLabel(c)} (${c.academicYear})` }));
  const studentOptions = students.map((s) => ({ value: s.id, label: `${s.name} · ${s.admissionNo}` }));

  const targets: Target[] = useMemo(() => {
    if (!year || !term) return [];
    const inScope =
      scope === 'school'
        ? classes.filter((c) => c.academicYear === year)
        : classes.filter((c) => c.id === classId);
    return inScope.map((cls) => {
      const matches = plans.filter(
        (p) => p.academicYear === year && termOf(p) === term && (p.classes ?? []).some((pc) => pc.class.id === cls.id),
      );
      return { cls, plan: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 };
    });
  }, [plans, classes, scope, classId, year, term]);

  const ready = targets.filter((x) => x.plan);
  const missing = targets.filter((x) => !x.plan);
  const studentCount = ready.reduce((n, x) => n + (x.cls._count?.students ?? 0), 0);
  const canAssign =
    !running && !outcome && ready.length > 0 && (scope !== 'student' || (!!studentId && missing.length === 0));

  async function assign() {
    setRunning(true);
    const result: Outcome = { assigned: 0, alreadyHad: 0, failed: [] };
    if (scope === 'student') {
      const plan = ready[0].plan!;
      try {
        await api.post('/student-fees', { studentId, feeStructureId: plan.id });
        result.assigned = 1;
      } catch (e) {
        result.failed.push({ label: students.find((s) => s.id === studentId)?.name ?? '', reason: errorText(e) });
      }
    } else {
      // One class at a time; the API skips students who already have this fee.
      for (const { cls, plan } of ready) {
        try {
          const res = await api.post<{ assigned: number; skipped: number }>(`/fee-structures/${plan!.id}/assign-class`, {
            classId: cls.id,
          });
          result.assigned += res.assigned;
          result.alreadyHad += res.skipped;
        } catch (e) {
          result.failed.push({ label: classLabel(cls), reason: errorText(e) });
        }
      }
    }
    setOutcome(result);
    setRunning(false);
  }

  const scopes: Array<[Scope, string]> = [
    ['student', t('scopeStudent')],
    ['class', t('scopeClass')],
    ['school', t('scopeSchool')],
  ];

  return (
    <Modal open={open} onClose={close} title={t('title')} size="lg">
      {loading ? (
        <div className="flex justify-center p-10">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : loadError ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      ) : plans.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{t('noPlans')}</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-gray-800">{t('assignTo')}</p>
            <div className="inline-flex rounded-xl border border-gray-300 bg-white p-1" role="radiogroup">
              {scopes.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={scope === value}
                  disabled={running || !!outcome}
                  onClick={() => pickScope(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    scope === value ? 'bg-teal text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              id="assign-year"
              label={t('year')}
              options={yearOptions}
              value={year}
              disabled={running || !!outcome}
              onChange={(e) => {
                setYear(e.target.value);
                setTerm(currentTerm(plans.filter((p) => p.academicYear === e.target.value)));
              }}
            />
            <Select
              id="assign-term"
              label={t('term')}
              options={termOptions}
              placeholder={t('selectTerm')}
              value={term}
              disabled={running || !!outcome}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {scope !== 'school' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                id="assign-class"
                label={t('class')}
                options={classOptions}
                placeholder={tCommon('selectClass')}
                value={classId}
                disabled={running || !!outcome}
                onChange={(e) => pickClass(e.target.value)}
              />
              {scope === 'student' && (
                <Select
                  id="assign-student"
                  label={t('student')}
                  options={studentOptions}
                  placeholder={t('selectStudent')}
                  value={studentId}
                  disabled={running || !!outcome || !classId}
                  onChange={(e) => setStudentId(e.target.value)}
                />
              )}
            </div>
          )}

          {targets.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <ul className="max-h-60 divide-y divide-gray-100 overflow-y-auto">
                {targets.map(({ cls, plan, ambiguous }) => (
                  <li key={cls.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-900">{classLabel(cls)}</span>
                    {plan ? (
                      <span className="text-gray-600">
                        {plan.name} · {formatRupees(plan.totalAmount)} · {t('dueOn', { date: formatDateOnly(plan.dueDate) })}
                        {scope !== 'student' && (
                          <span className="text-gray-400"> · {t('studentCount', { count: cls._count?.students ?? 0 })}</span>
                        )}
                      </span>
                    ) : (
                      <span className="font-semibold text-red-600">
                        {ambiguous ? t('ambiguous', { term, year }) : t('noPlanFor', { term, year })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!outcome && targets.length > 0 && scope !== 'student' && (
            <p className="text-sm text-gray-600">
              {ready.length > 0 && t('summary', { classes: ready.length, students: studentCount })}{' '}
              {missing.length > 0 && <span className="font-semibold text-red-600">{t('summarySkipped', { count: missing.length })}</span>}
            </p>
          )}

          {outcome && (
            <div
              className={`rounded-xl p-4 text-sm ${outcome.failed.length || missing.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}
              role="status"
            >
              <p className="font-semibold">{t('done', { count: outcome.assigned })}</p>
              {outcome.alreadyHad > 0 && <p>{t('alreadyHad', { count: outcome.alreadyHad })}</p>}
              {missing.length > 0 && (
                <p className="font-semibold text-red-700">
                  {t('skippedClasses', { classes: missing.map((m) => classLabel(m.cls)).join(', ') })}
                </p>
              )}
              {outcome.failed.map((f) => (
                <p key={f.label}>
                  {f.label}: {f.reason}
                </p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {outcome ? (
              <Button type="button" onClick={close}>
                {t('close')}
              </Button>
            ) : (
              <>
                <Button variant="secondary" type="button" onClick={close} disabled={running}>
                  {tCommon('cancel')}
                </Button>
                <Button type="button" onClick={assign} disabled={!canAssign} loading={running}>
                  {t('submit')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** The term whose earliest due date is the next one from today; else the last term. */
function currentTerm(plans: FeePlan[]): string {
  const firstDue = new Map<string, string>();
  for (const p of plans) {
    const term = termOf(p);
    const due = p.dueDate.slice(0, 10);
    if (!firstDue.has(term) || due < firstDue.get(term)!) firstDue.set(term, due);
  }
  const today = new Date().toISOString().slice(0, 10);
  const terms = [...firstDue.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  return (terms.find(([, due]) => due >= today) ?? terms[terms.length - 1])?.[0] ?? '';
}
