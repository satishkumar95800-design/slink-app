'use client';

import { UserMinus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api-client';
import { classLabel, compareClasses } from '../../../lib/fee-terms';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { ClassOption, ClassStudent, Rider, Route } from './types';

/** Who rides a route: change a stop, take students off, add students by class. */
export function RouteStudents({ route, onChanged }: { route: Route; onChanged: () => void }) {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [riders, setRiders] = useState<Rider[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<Rider[]>(`/transport/routes/${route.id}/students`)
      .then(setRiders)
      .catch((e) => {
        setRiders([]);
        toast(errorText(e), 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id]);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done, 'success');
      load();
      onChanged();
      return true;
    } catch (e) {
      toast(errorText(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const stopOptions = route.stops.map((s) => ({ value: s.id, label: s.pickupTime ? t('stopOption', { name: s.name, time: s.pickupTime }) : s.name }));

  return (
    <div className="space-y-4">
      <AddStudents route={route} disabled={busy} onAdd={(studentIds, stopId) => run(() => api.post('/transport/assign', { routeId: route.id, stopId, studentIds }), t('studentsAdded', { count: studentIds.length }))} />

      {!riders ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : riders.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noRiders')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {riders.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                <p className="text-xs text-gray-500">{t('riderMeta', { className: classLabel({ ...r.class, academicYear: '' }), admissionNo: r.admissionNo })}</p>
              </div>
              <div className="w-52">
                <Select
                  aria-label={t('stop')}
                  value={r.stopId ?? ''}
                  disabled={busy}
                  placeholder={t('noStop')}
                  options={stopOptions}
                  onChange={(e) => run(() => api.post('/transport/assign', { routeId: route.id, stopId: e.target.value, studentIds: [r.id] }), t('stopChanged'))}
                />
              </div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => api.post('/transport/unassign', { studentIds: [r.id] }), t('studentRemoved'))} aria-label={t('removeStudent', { name: r.name })}>
                <UserMinus className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddStudents({ route, disabled, onAdd }: { route: Route; disabled: boolean; onAdd: (ids: string[], stopId: string) => Promise<boolean> }) {
  const t = useTranslations('schoolBus');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState<ClassStudent[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stopId, setStopId] = useState('');

  useEffect(() => {
    api.get<ClassOption[]>('/classes').then((c) => setClasses([...c].sort(compareClasses))).catch(() => {});
  }, []);
  useEffect(() => {
    setPicked(new Set());
    if (!classId) return setStudents(null);
    api.get<ClassStudent[]>(`/transport/students?classId=${classId}`).then(setStudents).catch(() => setStudents([]));
  }, [classId]);

  const candidates = useMemo(() => (students ?? []).filter((s) => s.routeId !== route.id), [students, route.id]);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="rounded-2xl border border-black/5 bg-cream/40 p-3">
      <p className="text-sm font-semibold text-gray-800">{t('addStudents')}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Select aria-label={t('class')} value={classId} onChange={(e) => setClassId(e.target.value)} placeholder={t('pickClass')} options={classes.map((c) => ({ value: c.id, label: classLabel(c) }))} />
        <Select aria-label={t('stop')} value={stopId} onChange={(e) => setStopId(e.target.value)} placeholder={t('noStop')} options={route.stops.map((s) => ({ value: s.id, label: s.name }))} />
      </div>
      {students && (
        <>
          {candidates.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t('classAllOnRoute')}</p>
          ) : (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {candidates.map((s) => (
                <li key={s.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white">
                    <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} className="h-4 w-4 accent-teal" />
                    <span className="text-gray-900">{s.name}</span>
                    {s.routeName && <span className="text-xs text-amber-700">{t('onOtherRoute', { route: s.routeName })}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {candidates.length > 0 && (
              <button type="button" className="cursor-pointer text-sm font-semibold text-teal" onClick={() => setPicked(picked.size === candidates.length ? new Set() : new Set(candidates.map((s) => s.id)))}>
                {picked.size === candidates.length ? t('selectNone') : t('selectAll')}
              </button>
            )}
            <Button
              size="sm"
              disabled={disabled || picked.size === 0}
              onClick={async () => {
                if (await onAdd([...picked], stopId)) {
                  setPicked(new Set());
                  setClassId('');
                }
              }}
            >
              {t('addCount', { count: picked.size })}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
