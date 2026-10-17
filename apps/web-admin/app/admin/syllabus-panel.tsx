'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../lib/api-client';
import { formatDateOnly } from '../../lib/format';
import { Spinner } from '../../components/ui/spinner';
import { ProgressBar, StatusBadge } from './syllabus/progress';
import type { OverviewRow, Plan, SyllabusStatus } from './syllabus/types';

const ORDER: SyllabusStatus[] = ['late', 'on_time', 'not_planned', 'completed'];
const TONE: Record<SyllabusStatus, string> = {
  late: 'bg-red-50 text-red-700',
  on_time: 'bg-teal/10 text-teal',
  not_planned: 'bg-gray-100 text-gray-600',
  completed: 'bg-emerald-50 text-emerald-700',
};

export function syllabusCounts(rows: OverviewRow[]) {
  const c: Record<SyllabusStatus, number> = { late: 0, on_time: 0, not_planned: 0, completed: 0 };
  for (const r of rows) c[r.status]++;
  return c;
}

/** Dashboard card body: subjects by status, then the furthest behind. */
export function SyllabusSummary({ rows }: { rows: OverviewRow[] }) {
  const t = useTranslations('syllabus');
  const counts = syllabusCounts(rows);
  const late = rows.filter((r) => r.status === 'late').sort((a, b) => b.daysLate - a.daysLate).slice(0, 3);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDER.map((s) => (
          <div key={s} className={`rounded-xl px-3 py-2 ${TONE[s]}`}>
            <p className="text-xl font-extrabold">{counts[s]}</p>
            <p className="text-xs font-semibold">{t(`count.${s}`)}</p>
          </div>
        ))}
      </div>
      {late.length > 0 ? (
        <ul className="space-y-3">
          {late.map((r) => (
            <li key={`${r.classId}:${r.subjectId}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium text-gray-900">{t('planTitle', { subject: r.subjectName, className: r.className })}</span>
                <StatusBadge p={r} />
              </div>
              <ProgressBar p={r} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">{rows.length ? t('allOnTime') : t('emptyAdmin')}</p>
      )}
    </div>
  );
}

/** Drawer: every class's subjects as a roadmap; a subject opens its topic timeline. */
export function SyllabusRoadmap({ rows }: { rows: OverviewRow[] }) {
  const t = useTranslations('syllabus');
  const byClass = new Map<string, OverviewRow[]>();
  for (const r of rows) byClass.set(r.className, [...(byClass.get(r.className) ?? []), r]);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500">{t('roadmapLegend')}</p>
        <Link href="/admin/syllabus" className="text-sm font-semibold text-teal underline">
          {t('openSyllabusPage')}
        </Link>
      </div>
      {[...byClass.entries()].map(([name, list]) => (
        <section key={name} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900">{name}</h3>
          <ul className="mt-2 divide-y divide-gray-100">
            {list.map((r) => (
              <RoadmapRow key={r.subjectId} row={r} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RoadmapRow({ row }: { row: OverviewRow }) {
  const t = useTranslations('syllabus');
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);

  function toggle() {
    setOpen((o) => !o);
    if (plan === undefined)
      api
        .get<Plan>(`/syllabus/${row.classId}/${row.subjectId}`)
        .then(setPlan)
        .catch(() => setPlan(null));
  }

  return (
    <li className="py-3">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-900">
              {row.subjectName}
              {row.teachers.length > 0 && <span className="font-normal text-gray-500"> · {row.teachers.map((x) => x.name).join(', ')}</span>}
            </span>
            <StatusBadge p={row} />
          </div>
          <ProgressBar p={row} className="mt-2" />
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 pl-1">
          {plan === undefined ? (
            <Spinner className="h-5 w-5 text-teal" />
          ) : plan === null || plan.topics.length === 0 ? (
            <p className="text-sm text-gray-500">{t('emptyPlan')}</p>
          ) : (
            <ol className="relative space-y-2 border-l-2 border-gray-100 pl-4">
              {plan.topics.map((topic) => (
                <li key={topic.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                      topic.completedOn ? 'bg-emerald-500' : topic.overdue ? 'bg-red-500' : 'bg-gray-300'
                    }`}
                  />
                  <p className="text-sm text-gray-900">{topic.title}</p>
                  <p className={`text-xs ${topic.overdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    {topic.completedOn
                      ? t('timelineCovered', { target: formatDateOnly(topic.plannedBy), date: formatDateOnly(topic.completedOn) })
                      : topic.overdue
                        ? t('lateSince', { date: formatDateOnly(topic.plannedBy) })
                        : t('dueBy', { date: formatDateOnly(topic.plannedBy) })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}
