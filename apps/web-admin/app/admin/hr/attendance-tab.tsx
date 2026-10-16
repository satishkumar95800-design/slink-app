'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { ATTENDANCE_STATUSES, AttendanceStatus, DailySheet, MonthSummary } from './types';

const todayYmd = () => new Date().toLocaleDateString('en-CA');

export function AttendanceTab() {
  const t = useTranslations('hr');
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['daily', 'monthly'] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} onClick={() => setView(v)}>
            {t(v === 'daily' ? 'attDaily' : 'attMonthly')}
          </Button>
        ))}
      </div>
      {view === 'daily' ? <DailySheetView /> : <MonthlyView />}
    </div>
  );
}

function DailySheetView() {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [date, setDate] = useState(todayYmd());
  const [sheet, setSheet] = useState<DailySheet | null>(null);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | ''>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .get<DailySheet>(`/hrms/attendance/daily?date=${date}`)
      .then((s) => {
        if (!live) return;
        setSheet(s);
        setMarks(Object.fromEntries(s.rows.map((r) => [r.employeeId, r.status ?? ''])));
        setNotes(Object.fromEntries(s.rows.map((r) => [r.employeeId, r.note ?? ''])));
      })
      .catch((e) => live && toast(errorText(e), 'error'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, version]);

  function markAll(status: AttendanceStatus) {
    if (!sheet) return;
    setMarks(Object.fromEntries(sheet.rows.map((r) => [r.employeeId, r.leaveLinked ? (r.status ?? '') : status])));
  }

  async function save() {
    if (!sheet) return;
    const entries = sheet.rows
      .filter((r) => !r.leaveLinked && marks[r.employeeId])
      .map((r) => ({
        employeeId: r.employeeId,
        status: marks[r.employeeId] as AttendanceStatus,
        ...(notes[r.employeeId]?.trim() ? { note: notes[r.employeeId].trim() } : {}),
      }));
    if (entries.length === 0) return;
    setSaving(true);
    try {
      await api.put('/hrms/attendance/daily', { date, entries });
      toast(t('attendanceSaved'), 'success');
      setVersion((v) => v + 1);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label={t('date')} type="date" max={todayYmd()} value={date} onChange={(e) => { setLoading(true); setDate(e.target.value); }} />
        {sheet?.dayKind === 'HOLIDAY' && <Badge variant="purple">{t('holidayNamed', { name: sheet.holidayName ?? '' })}</Badge>}
        {sheet?.dayKind === 'WEEKLY_OFF' && <Badge variant="gray">{t('weeklyOff')}</Badge>}
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => markAll('PRESENT')}>
            {t('markAllPresent')}
          </Button>
          <Button size="sm" loading={saving} onClick={save}>
            {tCommon('save')}
          </Button>
        </span>
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : !sheet || sheet.rows.length === 0 ? (
        <EmptyState title={t('noEmployeesForDay')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('colName')}</th>
                <th className="px-4 py-2">{t('colDesignation')}</th>
                <th className="px-4 py-2">{t('attStatus')}</th>
                <th className="px-4 py-2">{t('note')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sheet.rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {r.name}
                    <span className="ml-2 font-mono text-xs text-gray-400">{r.employeeCode}</span>
                  </td>
                  <td className="px-4 py-2">{r.designation}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {ATTENDANCE_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={r.leaveLinked}
                          onClick={() => setMarks({ ...marks, [r.employeeId]: s })}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                            marks[r.employeeId] === s ? 'border-teal bg-teal text-white' : 'border-gray-300 text-gray-600 hover:bg-teal/10'
                          }`}
                        >
                          {t(`attStatuses.${s}`)}
                        </button>
                      ))}
                      {r.leaveLinked && <Badge variant="orange">{t('leaveLinked')}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full min-w-32 rounded-lg border border-gray-200 px-2 py-1 text-xs"
                      maxLength={200}
                      disabled={r.leaveLinked}
                      value={notes[r.employeeId] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [r.employeeId]: e.target.value })}
                      aria-label={t('note')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MonthlyView() {
  const t = useTranslations('hr');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [month, setMonth] = useState(todayYmd().slice(0, 7));
  const [data, setData] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    api
      .get<MonthSummary>(`/hrms/attendance/monthly?month=${month}`)
      .then((d) => live && setData(d))
      .catch((e) => live && toast(errorText(e), 'error'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label={t('month')} type="month" value={month} onChange={(e) => { if (e.target.value) { setLoading(true); setMonth(e.target.value); } }} />
        {data && (
          <p className="text-sm text-gray-500">
            {t('monthMeta', { days: data.totals.days, weeklyOffs: data.totals.weeklyOffs, holidays: data.totals.holidays })}
          </p>
        )}
      </div>
      {data && data.holidays.length > 0 && (
        <p className="text-xs text-gray-500">{data.holidays.map((h) => `${formatDateOnly(h.date)} ${h.name}`).join(' · ')}</p>
      )}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : !data || data.rows.length === 0 ? (
        <EmptyState title={t('noEmployeesForDay')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('colName')}</th>
                <th className="px-4 py-2">{t('attStatuses.PRESENT')}</th>
                <th className="px-4 py-2">{t('attStatuses.ABSENT')}</th>
                <th className="px-4 py-2">{t('attStatuses.HALF_DAY')}</th>
                <th className="px-4 py-2">{t('attStatuses.ON_LEAVE')}</th>
                <th className="px-4 py-2">{t('unmarked')}</th>
                <th className="px-4 py-2">{t('lopDays')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.rows.map((r) => (
                <tr key={r.employeeId}>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2">{r.present}</td>
                  <td className="px-4 py-2">{r.absent}</td>
                  <td className="px-4 py-2">{r.halfDay}</td>
                  <td className="px-4 py-2">{r.onLeave}</td>
                  <td className="px-4 py-2">{r.unmarked}</td>
                  <td className="px-4 py-2 font-semibold">{r.lopDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
