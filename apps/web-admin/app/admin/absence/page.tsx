'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatMonthYear, weekdayName } from '../../../lib/format';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface LeaveRequest {
  id: string;
  leaveType: { name: string };
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: number | string;
  reason: string;
  status: LeaveStatus;
  decisionNote?: string | null;
}

interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  isPaid: boolean;
  allowance: number | string;
  used: number | string;
  pending: number | string;
  available: number | string;
}

interface LeaveType {
  id: string;
  name: string;
}

/** A holiday, school event or PTM (GET /calendar), or a holiday from the attendance list. */
interface CalendarItem {
  id: string;
  type: 'HOLIDAY' | 'EVENT' | 'PTM';
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
}

/** Why leave can't be used here: the HR module is off, or this teacher has no employee record. */
type LeaveUnavailable = 'off' | 'noRecord' | 'failed' | null;

const STATUS_VARIANT: Record<LeaveStatus, 'yellow' | 'green' | 'red' | 'gray'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
};

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayYmd = () => ymd(new Date());
const days = (v: number | string) => {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

/** Monday-first weeks covering the month ("YYYY-MM"). */
function monthGrid(month: string): string[][] {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const weeks: string[][] = [];
  const cursor = new Date(start);
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(ymd(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === m - 1);
  return weeks;
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Teacher's own absence: leave requests and balances on a month calendar with holidays and school events. */
export default function AbsencePage() {
  const t = useTranslations('absence');
  const locale = useLocale();
  const errorText = useErrorText();
  const { toast } = useToast();
  const { features, loaded } = useTenantFeaturesState();
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [leaveError, setLeaveError] = useState<LeaveUnavailable>(null);
  const [leaveLoaded, setLeaveLoaded] = useState(false);
  const [applyFrom, setApplyFrom] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const weeks = useMemo(() => monthGrid(month), [month]);
  const gridFrom = weeks[0][0];
  const gridTo = weeks[weeks.length - 1][6];

  const fetchLeave = useCallback(
    () =>
      Promise.all([
        api.get<LeaveRequest[]>('/hrms/me/leave/requests'),
        api.get<LeaveBalance[]>('/hrms/me/leave/balances'),
        api.get<LeaveType[]>('/hrms/me/leave/types'),
      ]).then(
        ([req, bal, typ]) => {
          setRequests(req);
          setBalances(bal);
          setTypes(typ);
          setLeaveError(null);
          setLeaveLoaded(true);
        },
        (e: unknown) => {
          const code = (e as { code?: string })?.code;
          setLeaveError(code === 'NO_EMPLOYEE_RECORD' ? 'noRecord' : code === 'FEATURE_DISABLED' ? 'off' : 'failed');
          setLeaveLoaded(true);
        },
      ),
    [],
  );

  useEffect(() => {
    if (loaded && features.hrms) void fetchLeave();
  }, [loaded, features.hrms, fetchLeave]);

  // Leave needs the HR module; without it the calendar still shows holidays and events.
  const unavailable: LeaveUnavailable = loaded && !features.hrms ? 'off' : leaveError;
  const leaveLoading = !unavailable && !leaveLoaded;

  // Holidays and events for the visible weeks: the school calendar when it is on, else just holidays.
  useEffect(() => {
    if (!loaded) return;
    let live = true;
    const load = features.calendar
      ? api.get<{ data: CalendarItem[] }>(`/calendar?from=${gridFrom}&to=${gridTo}`).then((r) => r.data)
      : api
          .get<Array<{ id: string; name: string; date: string }>>(`/attendance/holidays?from=${gridFrom}&to=${gridTo}`)
          .then((rows) =>
            rows.map((h): CalendarItem => ({
              id: h.id,
              type: 'HOLIDAY',
              title: h.name,
              startDate: h.date,
              endDate: h.date,
            })),
          );
    load.then((rows) => live && setItems(rows)).catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [loaded, features.calendar, gridFrom, gridTo]);

  const itemsOn = (day: string) => items.filter((i) => i.startDate <= day && day <= i.endDate);
  // Rejected and cancelled requests are in the list below, not on the calendar.
  const leaveOn = (day: string) =>
    requests.filter((r) => (r.status === 'PENDING' || r.status === 'APPROVED') && r.fromDate <= day && day <= r.toDate);

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      await api.post(`/hrms/me/leave/requests/${id}/cancel`, {});
      toast(t('cancelled'), 'success');
      await fetchLeave();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setCancellingId(null);
    }
  }

  const today = todayYmd();
  const canApply = !unavailable && !leaveLoading;
  const sortedRequests = [...requests].sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  return (
    <div className="space-y-5">
      {unavailable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailable === 'noRecord' ? t('noRecord') : unavailable === 'failed' ? t('leaveLoadFailed') : t('leaveOff')}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="rounded-lg p-1.5 text-teal hover:bg-gray-100"
              aria-label={t('prevMonth')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="min-w-32 text-center text-base font-bold text-gray-900">{formatMonthYear(month, locale)}</h2>
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              className="rounded-lg p-1.5 text-teal hover:bg-gray-100"
              aria-label={t('nextMonth')}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            {month !== today.slice(0, 7) && (
              <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="text-xs text-teal hover:underline">
                {t('thisMonth')}
              </button>
            )}
          </div>
          {canApply && <Button onClick={() => setApplyFrom(today)}>{t('apply')}</Button>}
        </div>

        <div className="mb-2 flex flex-wrap gap-3 text-xs text-gray-600">
          <Legend className="bg-red-100" label={t('legendHoliday')} />
          <Legend className="bg-sky-100" label={t('legendEvent')} />
          <Legend className="bg-violet-100" label={t('legendPtm')} />
          <Legend className="bg-green-100" label={t('legendApproved')} />
          <Legend className="bg-amber-100" label={t('legendPending')} />
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="bg-cream/60 px-2 py-1.5 text-center text-xs font-semibold uppercase text-teal/80">
                {weekdayName(d, locale, 'short')}
              </div>
            ))}
            {weeks.flat().map((day) => {
              const inMonth = day.slice(0, 7) === month;
              const dayItems = itemsOn(day);
              const dayLeave = leaveOn(day);
              const holiday = dayItems.some((i) => i.type === 'HOLIDAY');
              const clickable = canApply && inMonth && day >= today;
              return (
                <div
                  key={day}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  title={clickable ? t('applyFrom', { date: formatDateOnly(day) }) : undefined}
                  onClick={clickable ? () => setApplyFrom(day) : undefined}
                  onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && setApplyFrom(day) : undefined}
                  className={`min-h-24 p-1.5 text-left ${inMonth ? (holiday ? 'bg-red-50' : 'bg-white') : 'bg-gray-50'} ${
                    clickable ? 'cursor-pointer hover:bg-cream/40' : ''
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      day === today ? 'bg-coral text-white' : inMonth ? 'text-gray-800' : 'text-gray-400'
                    }`}
                  >
                    {Number(day.slice(8))}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.map((i) => (
                      <p
                        key={i.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          i.type === 'HOLIDAY'
                            ? 'bg-red-100 text-red-800'
                            : i.type === 'PTM'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-sky-100 text-sky-800'
                        }`}
                        title={i.title}
                      >
                        {i.startTime ? `${i.startTime} ` : ''}
                        {i.title}
                      </p>
                    ))}
                    {dayLeave.map((r) => (
                      <p
                        key={r.id}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          r.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                        title={r.reason}
                      >
                        {r.halfDay ? t('halfDayLeave', { type: r.leaveType.name }) : r.leaveType.name}
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!unavailable && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-teal">{t('balances')}</h2>
            {leaveLoading ? (
              <div className="flex justify-center p-6">
                <Spinner className="h-5 w-5 text-teal" />
              </div>
            ) : balances.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">{t('noBalances')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {balances.map((b) => (
                  <li key={b.leaveTypeId} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-500">
                        {t('balanceDetail', {
                          used: days(b.used),
                          allowance: days(b.allowance),
                        })}
                        {Number(b.pending) > 0 && ` · ${t('pendingDays', { pending: days(b.pending) })}`}
                      </p>
                    </div>
                    <p className="text-right">
                      <span className="text-lg font-bold text-teal">{days(b.available)}</span>
                      <span className="block text-[11px] text-gray-500">{t('available')}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:col-span-2">
            <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-teal">{t('myRequests')}</h2>
            {leaveLoading ? (
              <div className="flex justify-center p-6">
                <Spinner className="h-5 w-5 text-teal" />
              </div>
            ) : sortedRequests.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-500">{t('noRequests')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {sortedRequests.map((r) => {
                  // Pending requests, and approved ones that haven't started, can be cancelled.
                  const cancellable = r.status === 'PENDING' || (r.status === 'APPROVED' && r.fromDate > today);
                  return (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {r.leaveType.name} · {formatDateOnly(r.fromDate)}
                          {r.toDate !== r.fromDate && ` – ${formatDateOnly(r.toDate)}`}
                          <span className="text-gray-500">
                            {' '}
                            · {r.halfDay ? t('halfDay') : t('dayCount', { days: days(r.days) })}
                          </span>
                        </p>
                        <p className="break-words text-xs text-gray-500">{r.reason}</p>
                        {r.decisionNote && <p className="text-xs italic text-gray-500">{r.decisionNote}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={STATUS_VARIANT[r.status]}>{t(`status.${r.status}`)}</Badge>
                        {cancellable && (
                          <button
                            type="button"
                            onClick={() => cancel(r.id)}
                            disabled={cancellingId === r.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {t('cancel')}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <ApplyLeaveModal
        // A fresh form each time it opens.
        key={applyFrom ?? 'closed'}
        from={applyFrom}
        types={types}
        balances={balances}
        onClose={() => setApplyFrom(null)}
        onApplied={() => {
          setApplyFrom(null);
          void fetchLeave();
        }}
      />
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}

function ApplyLeaveModal({
  from,
  types,
  balances,
  onClose,
  onApplied,
}: {
  from: string | null;
  types: LeaveType[];
  balances: LeaveBalance[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const t = useTranslations('absence');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [typeId, setTypeId] = useState('');
  const [fromDate, setFromDate] = useState(from ?? '');
  const [toDate, setToDate] = useState(from ?? '');
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const oneDay = !!fromDate && fromDate === toDate;
  const valid = !!typeId && !!fromDate && !!toDate && toDate >= fromDate && reason.trim().length > 0;
  const typeOptions = types.map((ty) => {
    const b = balances.find((x) => x.leaveTypeId === ty.id);
    return {
      value: ty.id,
      label: b ? t('typeWithBalance', { type: ty.name, available: days(b.available) }) : ty.name,
    };
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      await api.post('/hrms/me/leave/requests', {
        leaveTypeId: typeId,
        fromDate,
        toDate,
        halfDay: oneDay && halfDay,
        reason: reason.trim(),
      });
      toast(t('applied'), 'success');
      onApplied();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!from} onClose={onClose} title={t('applyTitle')}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          id="leave-type"
          label={t('leaveType')}
          required
          options={typeOptions}
          placeholder={t('selectType')}
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('from')}
            required
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (!toDate || toDate < e.target.value) setToDate(e.target.value);
            }}
          />
          <Input label={t('to')} required type="date" min={fromDate} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {oneDay && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={halfDay}
              onChange={(e) => setHalfDay(e.target.checked)}
              className="h-4 w-4 accent-coral"
            />
            {t('halfDay')}
          </label>
        )}
        <Input label={t('reason')} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        <p className="text-xs text-gray-500">{t('applyHelp')}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!valid} loading={saving}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
