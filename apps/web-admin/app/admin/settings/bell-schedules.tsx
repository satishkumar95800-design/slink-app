'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface PeriodTiming {
  periodNumber: number;
  startTime: string;
  endTime: string;
}

interface ClassPeriodTiming extends PeriodTiming {
  classId: string;
}

interface SchoolClass {
  id: string;
  name: string;
  section: string | null;
}

type Rows = Record<number, { start: string; end: string }>;

/** Classes sharing exactly the same timings, shown and edited together. */
interface ClassGroup {
  key: string;
  classIds: string[];
  periods: PeriodTiming[];
}

const classLabel = (c: SchoolClass) => [c.name, c.section].filter(Boolean).join(' ');

function toRows(list: PeriodTiming[]): Rows {
  return Object.fromEntries(list.map((p) => [p.periodNumber, { start: p.startTime, end: p.endTime }]));
}

function groupByTimings(list: ClassPeriodTiming[]): ClassGroup[] {
  const byClass = new Map<string, PeriodTiming[]>();
  for (const row of list) {
    const periods = byClass.get(row.classId) ?? [];
    periods.push({ periodNumber: row.periodNumber, startTime: row.startTime, endTime: row.endTime });
    byClass.set(row.classId, periods);
  }
  const groups = new Map<string, ClassGroup>();
  for (const [classId, periods] of byClass) {
    periods.sort((a, b) => a.periodNumber - b.periodNumber);
    const key = periods.map((p) => `${p.periodNumber}=${p.startTime}-${p.endTime}`).join('|');
    const group = groups.get(key) ?? { key, classIds: [], periods };
    group.classIds.push(classId);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Period timings (Settings): the school's bell schedule, plus timings for chosen
 * classes (e.g. a primary block that starts earlier). Drives the teacher app's
 * "Now / Next" strip and the class reminders.
 */
export function BellSchedulesSection() {
  const t = useTranslations('periodTimings');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [schoolRows, setSchoolRows] = useState<Rows>({});
  const [classTimings, setClassTimings] = useState<ClassPeriodTiming[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [saving, setSaving] = useState(false);
  // null = closed; [] classIds = new group.
  const [editing, setEditing] = useState<{ classIds: string[]; rows: Rows } | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    api.get<PeriodTiming[]>('/timetable/period-timings').then((l) => setSchoolRows(toRows(l))).catch(() => {});
    api.get<ClassPeriodTiming[]>('/timetable/class-period-timings').then(setClassTimings).catch(() => {});
    api.get<SchoolClass[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  const groups = useMemo(() => groupByTimings(classTimings), [classTimings]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  /** Rows → API periods; null (after a toast) when a period has only one of its times. */
  function toPeriods(rows: Rows): PeriodTiming[] | null {
    const periods: PeriodTiming[] = [];
    for (const p of PERIODS) {
      const r = rows[p];
      if (!r || (!r.start && !r.end)) continue;
      if (!r.start || !r.end) {
        toast(t('incomplete', { n: p }), 'error');
        return null;
      }
      periods.push({ periodNumber: p, startTime: r.start, endTime: r.end });
    }
    return periods;
  }

  async function saveSchool() {
    const periods = toPeriods(schoolRows);
    if (!periods) return;
    setSaving(true);
    try {
      await api.put('/timetable/period-timings', { periods });
      toast(t('saved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  function openGroup(group?: ClassGroup) {
    setEditing({ classIds: group?.classIds ?? [], rows: group ? toRows(group.periods) : { ...schoolRows } });
    setEditingOriginal(group?.classIds ?? []);
  }

  async function saveGroup() {
    if (!editing) return;
    if (editing.classIds.length === 0) {
      toast(t('pickClass'), 'error');
      return;
    }
    const periods = toPeriods(editing.rows);
    if (!periods) return;
    if (periods.length === 0) {
      toast(t('needOnePeriod'), 'error');
      return;
    }
    setSavingGroup(true);
    try {
      let latest = await api.put<ClassPeriodTiming[]>('/timetable/class-period-timings', {
        classIds: editing.classIds,
        periods,
      });
      // Classes taken out of this group go back to the school timings.
      const dropped = editingOriginal.filter((id) => !editing.classIds.includes(id));
      if (dropped.length > 0) {
        latest = await api.put<ClassPeriodTiming[]>('/timetable/class-period-timings', { classIds: dropped, periods: [] });
      }
      setClassTimings(latest);
      setEditing(null);
      toast(t('classSaved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSavingGroup(false);
    }
  }

  async function removeGroup(group: ClassGroup) {
    if (!confirm(t('confirmRemove'))) return;
    try {
      setClassTimings(
        await api.put<ClassPeriodTiming[]>('/timetable/class-period-timings', { classIds: group.classIds, periods: [] }),
      );
      toast(t('classSaved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('help')}</p>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-gray-900">{t('schoolTitle')}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{t('schoolHelp')}</p>
        <PeriodGrid rows={schoolRows} onChange={setSchoolRows} />
        <div className="mt-4 flex justify-end">
          <Button onClick={saveSchool} loading={saving}>
            {t('save')}
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{t('classTitle')}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{t('classHelp')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => openGroup()}>
            {t('addClassSchedule')}
          </Button>
        </div>

        {groups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-cream/60 px-4 py-3 text-sm text-gray-500">{t('noClassSchedules')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {groups.map((g) => (
              <li key={g.key} className="rounded-xl border border-gray-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {g.classIds.map((id) => (
                      <span key={id} className="rounded-full bg-teal/10 px-2.5 py-0.5 text-xs font-bold text-teal">
                        {classById.get(id) ? classLabel(classById.get(id)!) : '—'}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <button type="button" className="cursor-pointer text-teal hover:underline" onClick={() => openGroup(g)}>
                      {t('edit')}
                    </button>
                    <button type="button" className="cursor-pointer text-red-600 hover:underline" onClick={() => removeGroup(g)}>
                      {t('removeSchedule')}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  {g.periods
                    .map((p) => t('periodRange', { n: p.periodNumber, start: p.startTime, end: p.endTime }))
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={t('editTitle')} size="xl">
        {editing && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{t('chooseClasses')}</p>
                <div className="flex gap-3 text-xs font-semibold text-teal">
                  <button
                    type="button"
                    className="cursor-pointer hover:underline"
                    onClick={() => setEditing({ ...editing, classIds: classes.map((c) => c.id) })}
                  >
                    {t('selectAll')}
                  </button>
                  <button type="button" className="cursor-pointer hover:underline" onClick={() => setEditing({ ...editing, classIds: [] })}>
                    {t('clearAll')}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = editing.classIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          classIds: on ? editing.classIds.filter((id) => id !== c.id) : [...editing.classIds, c.id],
                        })
                      }
                      className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
                        on ? 'border-teal bg-teal text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-teal'
                      }`}
                    >
                      {classLabel(c)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">{t('movedHint')}</p>
            </div>
            <PeriodGrid rows={editing.rows} onChange={(rows) => setEditing({ ...editing, rows })} />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                {t('cancel')}
              </Button>
              <Button type="button" loading={savingGroup} onClick={saveGroup}>
                {t('save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PeriodGrid({ rows, onChange }: { rows: Rows; onChange: (rows: Rows) => void }) {
  const t = useTranslations('periodTimings');
  function update(period: number, field: 'start' | 'end', value: string) {
    onChange({ ...rows, [period]: { start: rows[period]?.start ?? '', end: rows[period]?.end ?? '', [field]: value } });
  }
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PERIODS.map((p) => (
        <div key={p} className="rounded-xl border border-gray-100 p-3">
          <p className="text-xs font-semibold text-gray-500">{t('period', { n: p })}</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="time"
              aria-label={t('startOf', { n: p })}
              value={rows[p]?.start ?? ''}
              onChange={(e) => update(p, 'start', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
            <span className="text-gray-400">–</span>
            <input
              type="time"
              aria-label={t('endOf', { n: p })}
              value={rows[p]?.end ?? ''}
              onChange={(e) => update(p, 'end', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
