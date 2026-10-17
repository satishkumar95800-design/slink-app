'use client';

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { ProgressBar, StatusBadge } from './progress';
import { Plan, PlanTopic, todayYmd } from './types';

/** One editable row; `id` is absent until the plan is saved. */
interface Row {
  key: string;
  id?: string;
  unit: string;
  title: string;
  plannedBy: string;
  completedOn: string | null;
  completedBy: PlanTopic['completedBy'];
}

export interface ClassOption {
  id: string;
  label: string;
}

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;
const toRows = (topics: PlanTopic[]): Row[] =>
  topics.map((t) => ({
    key: t.id,
    id: t.id,
    unit: t.unit ?? '',
    title: t.title,
    plannedBy: t.plannedBy,
    completedOn: t.completedOn,
    completedBy: t.completedBy,
  }));
const sameRows = (a: Row[], b: Row[]) =>
  a.length === b.length &&
  a.every((r, i) => r.id === b[i].id && r.unit === b[i].unit && r.title === b[i].title && r.plannedBy === b[i].plannedBy);

/**
 * The topic list of one class's subject. Admins edit it (add, reorder, remove,
 * target dates) and copy it to other sections; anyone allowed to mark (the
 * subject teacher or an admin) ticks topics covered.
 */
export function PlanEditor({
  classId,
  subjectId,
  classes,
  onChanged,
}: {
  classId: string;
  subjectId: string;
  /** Every class, for "Copy to other sections". */
  classes: ClassOption[];
  onChanged: () => void;
}) {
  const t = useTranslations('syllabus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const load = useCallback(() => {
    api
      .get<Plan>(`/syllabus/${classId}/${subjectId}`)
      .then((p) => {
        setPlan(p);
        setRows(toRows(p.topics));
      })
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId]);
  useEffect(load, [load]);

  const savedRows = useMemo(() => (plan ? toRows(plan.topics) : []), [plan]);
  const dirty = !!plan && !sameRows(rows, savedRows);
  const today = todayYmd();
  const valid = rows.every((r) => r.title.trim() && r.plannedBy);

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function move(index: number, by: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const [r] = next.splice(index, 1);
      next.splice(index + by, 0, r);
      return next;
    });
  }
  function addRow() {
    const last = rows.at(-1);
    setRows((prev) => [
      ...prev,
      { key: newKey(), unit: last?.unit ?? '', title: '', plannedBy: last?.plannedBy ?? '', completedOn: null, completedBy: null },
    ]);
  }

  async function save() {
    const removedCovered = savedRows.filter((s) => s.completedOn && !rows.some((r) => r.id === s.id)).length;
    if (removedCovered > 0 && !confirm(t('confirmRemoveCovered', { count: removedCovered }))) return;
    setSaving(true);
    try {
      const p = await api.put<Plan>(`/syllabus/${classId}/${subjectId}`, {
        topics: rows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          ...(r.unit.trim() ? { unit: r.unit.trim() } : {}),
          title: r.title.trim(),
          plannedBy: r.plannedBy,
        })),
      });
      setPlan(p);
      setRows(toRows(p.topics));
      toast(t('saved'), 'success');
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  /** Ticks or unticks a saved topic; unsaved edits to other rows are kept. */
  async function toggleCovered(row: Row) {
    if (!row.id) return;
    setMarking(row.id);
    try {
      const p = row.completedOn
        ? await api.delete<Plan>(`/syllabus/topics/${row.id}/complete`)
        : await api.post<Plan>(`/syllabus/topics/${row.id}/complete`, {});
      const fresh = new Map(p.topics.map((x) => [x.id, x]));
      setPlan(p);
      setRows((prev) =>
        prev.map((r) => {
          const f = r.id ? fresh.get(r.id) : undefined;
          return f ? { ...r, completedOn: f.completedOn, completedBy: f.completedBy } : r;
        }),
      );
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setMarking(null);
    }
  }

  if (!plan)
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const canEdit = plan.canEdit;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600">
            {plan.teachers.length ? t('taughtBy', { names: plan.teachers.map((x) => x.name).join(', ') }) : t('noTeacher')}
          </p>
          <StatusBadge p={plan} />
        </div>
        <ProgressBar p={plan} className="mt-3" />
        {plan.total > 0 && plan.status !== 'completed' && (
          <p className="mt-1 text-xs text-gray-500">{t('expectedByToday', { count: plan.expectedByToday, total: plan.total })}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">
          {canEdit ? t('emptyPlanAdmin') : t('emptyPlan')}
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => {
            const late = !r.completedOn && !!r.plannedBy && r.plannedBy < today;
            return (
              <li key={r.key} className={`rounded-2xl border bg-white p-3 ${late ? 'border-red-200' : 'border-black/5'}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={!plan.canMark || !r.id || marking === r.id}
                    onClick={() => toggleCovered(r)}
                    aria-pressed={!!r.completedOn}
                    title={r.id ? (r.completedOn ? t('markNotCovered') : t('markCovered')) : t('saveFirst')}
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      r.completedOn ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white'
                    } ${plan.canMark && r.id ? 'cursor-pointer hover:border-emerald-500' : 'cursor-not-allowed opacity-60'}`}
                  >
                    {r.completedOn && <Check className="h-4 w-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    {canEdit ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                        <input
                          aria-label={t('unit')}
                          placeholder={t('unitPlaceholder')}
                          maxLength={100}
                          value={r.unit}
                          onChange={(e) => update(r.key, { unit: e.target.value })}
                          className="min-w-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
                        />
                        <input
                          aria-label={t('topic')}
                          placeholder={t('topicPlaceholder')}
                          maxLength={200}
                          value={r.title}
                          onChange={(e) => update(r.key, { title: e.target.value })}
                          className={`min-w-0 rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30 ${
                            r.title.trim() ? 'border-gray-300' : 'border-red-300'
                          }`}
                        />
                      </div>
                    ) : (
                      <div>
                        {r.unit && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{r.unit}</p>}
                        <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {canEdit && (
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                          {t('targetDate')}
                          <input
                            type="date"
                            value={r.plannedBy}
                            onChange={(e) => update(r.key, { plannedBy: e.target.value })}
                            className={`rounded-lg border px-2 py-1 text-sm text-gray-900 outline-none focus:border-coral focus:ring-2 focus:ring-coral/30 ${
                              r.plannedBy ? 'border-gray-300' : 'border-red-300'
                            }`}
                          />
                        </label>
                      )}
                      <p className={`text-xs ${late ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                        {r.completedOn
                          ? t('coveredOn', { date: formatDateOnly(r.completedOn), name: r.completedBy?.name ?? '' })
                          : r.plannedBy
                            ? late
                              ? t('lateSince', { date: formatDateOnly(r.plannedBy) })
                              : canEdit
                                ? null
                                : t('dueBy', { date: formatDateOnly(r.plannedBy) })
                            : null}
                      </p>
                      {canEdit && (
                        <div className="ml-auto flex gap-1">
                          <button type="button" aria-label={t('moveUp')} disabled={i === 0} onClick={() => move(i, -1)} className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" aria-label={t('moveDown')} disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button type="button" aria-label={tCommon('remove')} onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))} className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && (
        <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-2 bg-cream/95 px-1 py-3 backdrop-blur">
          <Button variant="secondary" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4" />
            {t('addTopic')}
          </Button>
          {plan.topics.length > 0 && !dirty && (
            <Button variant="ghost" size="sm" onClick={() => setCopyOpen(true)}>
              {t('copyToSections')}
            </Button>
          )}
          <div className="flex-1" />
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setRows(savedRows)}>
              {t('discard')}
            </Button>
          )}
          <Button size="sm" loading={saving} disabled={!dirty || !valid} onClick={save}>
            {t('savePlan')}
          </Button>
        </div>
      )}

      {copyOpen && (
        <CopyDialog
          classId={classId}
          subjectId={subjectId}
          subjectName={plan.subject.name}
          classes={classes.filter((c) => c.id !== classId)}
          onClose={() => setCopyOpen(false)}
          onDone={() => {
            setCopyOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function CopyDialog({
  classId,
  subjectId,
  subjectName,
  classes,
  onClose,
  onDone,
}: {
  classId: string;
  subjectId: string;
  subjectName: string;
  classes: ClassOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('syllabus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy(replace: boolean) {
    setBusy(true);
    try {
      const res = await api.post<{ copied: number }>(`/syllabus/${classId}/${subjectId}/copy`, { classIds: [...picked], replace });
      toast(t('copied', { count: res.copied }), 'success');
      onDone();
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { error?: { classes?: string[] } }) : null;
      if (e instanceof ApiError && e.code === 'SYLLABUS_EXISTS' && body?.error?.classes) setConflicts(body.error.classes);
      else toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('copyTitle', { subject: subjectName })}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('copyHelp')}</p>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {classes.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-coral"
                checked={picked.has(c.id)}
                onChange={() =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    setConflicts(null);
                    return next;
                  })
                }
              />
              {c.label}
            </label>
          ))}
        </div>
        {conflicts && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t('copyConflict', { classes: conflicts.join(', ') })}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          {conflicts ? (
            <Button variant="danger" loading={busy} onClick={() => copy(true)}>
              {t('copyReplace')}
            </Button>
          ) : (
            <Button loading={busy} disabled={picked.size === 0} onClick={() => copy(false)}>
              {t('copy')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
