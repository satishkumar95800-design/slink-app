'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { useToast } from '../../../components/ui/toast';

type Status = 'present' | 'absent' | 'late' | 'leave';
const STATUSES: Status[] = ['present', 'absent', 'late', 'leave'];

const STATUS_CLASSES: Record<Status, string> = {
  present: 'bg-green-100 text-green-800 border-green-300',
  absent: 'bg-red-100 text-red-800 border-red-300',
  late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  leave: 'bg-blue-100 text-blue-800 border-blue-300',
};

interface ClassOption {
  id: string;
  name: string;
  section?: string | null;
  academicYear: string;
}

interface ReportRow {
  studentId: string;
  rollNo: string | null;
  studentName: string;
  admissionNo: string;
  className: string;
  daysMarked: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  percentage: number | null;
}

interface Roster {
  class: { id: string; name: string; section: string | null };
  date: string;
  today: string;
  holiday: { name: string } | null;
  submitted: boolean;
  canEdit: boolean;
  students: { id: string; name: string; admissionNo: string; rollNo: string | null; status: Status | null }[];
}

/** YYYY-MM-DD in the browser's local time; the API re-checks dates against the school's timezone. */
function localYmd(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstOfMonth() {
  return `${localYmd().slice(0, 7)}-01`;
}

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const [tab, setTab] = useState<'report' | 'mark'>('report');
  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    api.get<ClassOption[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  const classOptions = classes.map((c) => ({
    value: c.id,
    label: `${[c.name, c.section].filter(Boolean).join(' ')} (${c.academicYear})`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['report', 'mark'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              tab === key ? 'bg-teal text-white' : 'bg-white text-teal border border-teal/30 hover:bg-teal/10'
            }`}
          >
            {key === 'report' ? t('reportTab') : t('markTab')}
          </button>
        ))}
      </div>
      {tab === 'report' ? <ReportTab classOptions={classOptions} /> : <MarkTab classOptions={classOptions} />}
    </div>
  );
}

function ReportTab({ classOptions }: { classOptions: { value: string; label: string }[] }) {
  const t = useTranslations('attendance');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(() => localYmd());
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function params(format?: 'csv') {
    const p = new URLSearchParams({ from, to });
    if (classId) p.set('classId', classId);
    if (format) p.set('format', format);
    return p.toString();
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: ReportRow[] }>(`/attendance/report?${params()}`);
      setRows(res.data);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function exportCsv() {
    try {
      await apiDownload(`/attendance/report?${params('csv')}`, `attendance-${from}-to-${to}.csv`);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="w-full sm:w-64">
          <Select
            label={t('filterClass')}
            options={classOptions}
            placeholder={t('allClasses')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </div>
        <Input label={t('from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label={t('to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button onClick={run}>{t('load')}</Button>
        <Button variant="secondary" onClick={exportCsv}>
          {t('exportCsv')}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : rows === null ? null : rows.length === 0 ? (
        <EmptyState title={t('noStudents')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                {[t('colRollNo'), t('colStudent'), t('colClass'), t('colDaysMarked'), t('colPresent'), t('colLate'), t('colAbsent'), t('colLeave'), t('colPercentage')].map((h) => (
                  <th key={h} className="px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td className="px-4 py-3 text-gray-500">{r.rollNo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{r.studentName}</p>
                    <p className="text-xs text-gray-500">{r.admissionNo}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.className}</td>
                  <td className="px-4 py-3 text-gray-600">{r.daysMarked}</td>
                  <td className="px-4 py-3 text-gray-600">{r.present}</td>
                  <td className="px-4 py-3 text-gray-600">{r.late}</td>
                  <td className="px-4 py-3 text-gray-600">{r.absent}</td>
                  <td className="px-4 py-3 text-gray-600">{r.leave}</td>
                  <td className={`px-4 py-3 font-semibold ${r.percentage != null && r.percentage < 75 ? 'text-red-700' : 'text-gray-900'}`}>
                    {r.percentage != null ? `${r.percentage}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function MarkTab({ classOptions }: { classOptions: { value: string; label: string }[] }) {
  const t = useTranslations('attendance');
  const tStatus = useTranslations('attendanceStatus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => localYmd());
  const [roster, setRoster] = useState<Roster | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<Roster>(`/attendance/roster?classId=${classId}&date=${date}`);
      setRoster(r);
      // Unmarked students start as Present, like the teacher app.
      setStatuses(Object.fromEntries(r.students.map((st) => [st.id, st.status ?? 'present'])));
    } catch (e) {
      setError(errorText(e));
      setRoster(null);
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const v of Object.values(statuses)) c[v]++;
    return c;
  }, [statuses]);

  async function save() {
    if (!roster) return;
    if (!confirm(t('confirmSave', { present: counts.present + counts.late, absent: counts.absent }))) return;
    setSaving(true);
    try {
      const updated = await api.put<Roster>('/attendance/class', {
        classId: roster.class.id,
        date: roster.date,
        entries: roster.students.map((st) => ({ studentId: st.id, status: statuses[st.id] })),
      });
      setRoster(updated);
      toast(t('saved'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const editable = Boolean(roster?.canEdit);

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="w-full sm:w-64">
          <Select
            label={t('filterClass')}
            options={classOptions}
            placeholder={t('filterClass')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </div>
        <Input label={t('date')} type="date" value={date} max={localYmd()} onChange={(e) => setDate(e.target.value)} />
        <Button onClick={load} disabled={!classId}>
          {t('load')}
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !roster ? (
        <p className="text-sm text-gray-500">{t('pickClassAndDate')}</p>
      ) : roster.holiday ? (
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">{t('holidayNoMarking', { name: roster.holiday.name })}</div>
      ) : roster.students.length === 0 ? (
        <EmptyState title={t('noStudents')} />
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {[roster.class.name, roster.class.section].filter(Boolean).join(' ')} ·{' '}
                {formatDateOnly(roster.date)}
              </p>
              <p className="text-xs text-gray-500">
                {!editable ? t('readOnly') : roster.submitted ? t('alreadySubmitted') : ''}
              </p>
            </div>
            {editable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatuses(Object.fromEntries(roster.students.map((st) => [st.id, 'present' as Status])))}
              >
                {t('allPresent')}
              </Button>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {roster.students.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 text-right text-sm font-mono text-gray-500">{st.rollNo ?? '—'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{st.name}</p>
                    <p className="text-xs text-gray-500">{st.admissionNo}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={st.name}>
                  {STATUSES.map((status) => {
                    const selected = statuses[st.id] === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={!editable}
                        onClick={() => setStatuses((prev) => ({ ...prev, [st.id]: status }))}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                          selected ? STATUS_CLASSES[status] : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {tStatus(status)}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t bg-white px-6 py-4">
            <p className="text-sm font-semibold text-gray-900">
              {counts.late + counts.leave > 0
                ? t('countsWithOther', { present: counts.present, absent: counts.absent, other: counts.late + counts.leave })
                : t('counts', { present: counts.present, absent: counts.absent })}
            </p>
            {editable && (
              <Button onClick={save} loading={saving}>
                {t('save')}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
