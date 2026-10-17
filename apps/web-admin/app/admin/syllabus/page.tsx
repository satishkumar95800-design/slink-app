'use client';

import { ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { formatDateOnly } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { ImportDialog } from './import-dialog';
import { ClassOption, PlanEditor } from './plan-editor';
import { ProgressBar, StatusBadge } from './progress';
import type { OverviewRow, SyllabusStatus } from './types';

interface SchoolClass {
  id: string;
  name: string;
  section: string | null;
}
interface Subject {
  id: string;
  name: string;
}

const classLabel = (c: SchoolClass) => [c.name, c.section].filter(Boolean).join(' ');
const STATUSES: SyllabusStatus[] = ['late', 'on_time', 'not_planned', 'completed'];

/** Syllabus plans and progress: admins plan and track every subject, teachers see their own. */
export default function SyllabusPage() {
  const t = useTranslations('syllabus');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  const role = getSession()?.role;
  if (role !== 'admin' && role !== 'teacher') return <EmptyState title={t('noAccess')} />;
  if (!features.syllabus) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;
  return <Syllabus isAdmin={role === 'admin'} />;
}

function Syllabus({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('syllabus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<SyllabusStatus | ''>('');
  const [open, setOpen] = useState<{ classId: string; subjectId: string; title: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [newPlan, setNewPlan] = useState(false);

  const load = useCallback(() => {
    api
      .get<OverviewRow[]>('/syllabus/overview')
      .then(setRows)
      .catch((e) => {
        setRows([]);
        toast(errorText(e), 'error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    api.get<SchoolClass[]>('/classes').then(setClasses).catch(() => {});
    api.get<Subject[]>('/subjects').then(setSubjects).catch(() => {});
  }, [isAdmin]);

  const counts = useMemo(() => {
    const c: Record<SyllabusStatus, number> = { late: 0, on_time: 0, not_planned: 0, completed: 0 };
    for (const r of rows ?? []) c[r.status]++;
    return c;
  }, [rows]);
  const classOptions: ClassOption[] = useMemo(() => {
    const source = isAdmin ? classes : [...new Map((rows ?? []).map((r) => [r.classId, { id: r.classId, name: r.className, section: null }])).values()];
    return source.map((c) => ({ id: c.id, label: classLabel(c) }));
  }, [isAdmin, classes, rows]);
  const visible = (rows ?? []).filter((r) => (!classId || r.classId === classId) && (!status || r.status === status));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{isAdmin ? t('introAdmin') : t('introTeacher')}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
              {t('importExcel')}
            </Button>
            <Button size="sm" onClick={() => setNewPlan(true)}>
              {t('newPlan')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus((prev) => (prev === s ? '' : s))}
            aria-pressed={status === s}
            className={`cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
              status === s ? 'border-coral ring-2 ring-coral/20' : 'border-black/5 hover:border-gray-300'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t(`count.${s}`)}</p>
            <p className={`mt-1 text-2xl font-extrabold ${s === 'late' && counts.late > 0 ? 'text-red-600' : 'text-gray-900'}`}>{counts[s]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Select
            label={t('filterClass')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder={tCommon('all')}
            options={classOptions.map((c) => ({ value: c.id, label: c.label }))}
          />
        </div>
      </div>

      {!rows ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState title={rows.length === 0 ? t('emptyTitle') : t('noMatch')} description={rows.length === 0 ? (isAdmin ? t('emptyAdmin') : t('emptyTeacher')) : undefined} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colClass'), t('colSubject'), t('colTeacher'), t('colProgress'), t('colStatus'), t('colNext')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => (
                <tr
                  key={`${r.classId}:${r.subjectId}`}
                  tabIndex={0}
                  onClick={() => setOpen({ classId: r.classId, subjectId: r.subjectId, title: t('planTitle', { subject: r.subjectName, className: r.className }) })}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
                  className="cursor-pointer transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{r.className}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{r.subjectName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.teachers.map((x) => x.name).join(', ') || '—'}</td>
                  <td className="min-w-48 px-4 py-3">
                    <ProgressBar p={r} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge p={r} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm">
                    {r.nextTopic ? (
                      <>
                        <p className="truncate text-gray-900">{r.nextTopic.title}</p>
                        <p className="text-xs text-gray-500">{t('dueBy', { date: formatDateOnly(r.nextTopic.plannedBy) })}</p>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        subtitle={isAdmin ? t('editorHelpAdmin') : t('editorHelpTeacher')}
        icon={<ListChecks className="h-5 w-5" />}
      >
        {open && <PlanEditor key={`${open.classId}:${open.subjectId}`} classId={open.classId} subjectId={open.subjectId} classes={classOptions} onChanged={load} />}
      </Drawer>

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            load();
          }}
        />
      )}

      {newPlan && (
        <NewPlanDialog
          classes={classes}
          subjects={subjects}
          onClose={() => setNewPlan(false)}
          onPick={(c, s) => {
            setNewPlan(false);
            setOpen({ classId: c.id, subjectId: s.id, title: t('planTitle', { subject: s.name, className: classLabel(c) }) });
          }}
        />
      )}
    </div>
  );
}

function NewPlanDialog({
  classes,
  subjects,
  onClose,
  onPick,
}: {
  classes: SchoolClass[];
  subjects: Subject[];
  onClose: () => void;
  onPick: (c: SchoolClass, s: Subject) => void;
}) {
  const t = useTranslations('syllabus');
  const tCommon = useTranslations('common');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const c = classes.find((x) => x.id === classId);
  const s = subjects.find((x) => x.id === subjectId);
  return (
    <Modal open onClose={onClose} title={t('newPlan')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('newPlanHelp')}</p>
        <Select label={t('colClass')} required value={classId} onChange={(e) => setClassId(e.target.value)} placeholder={tCommon('selectClass')} options={classes.map((x) => ({ value: x.id, label: classLabel(x) }))} />
        <Select label={t('colSubject')} required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} placeholder={t('selectSubject')} options={subjects.map((x) => ({ value: x.id, label: x.name }))} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button disabled={!c || !s} onClick={() => c && s && onPick(c, s)}>
            {t('openPlan')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
