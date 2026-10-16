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
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { LEAVE_STATUSES, LeaveBalanceRow, LeaveRequest, LeaveStatus, LeaveType, Page } from './types';

type View = 'requests' | 'types' | 'balances';
const STATUS_VARIANT: Record<LeaveStatus, 'yellow' | 'green' | 'red' | 'gray'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
};

export function LeaveTab() {
  const t = useTranslations('hr');
  const [view, setView] = useState<View>('requests');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['requests', 'types', 'balances'] as const).map((v) => (
          <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} onClick={() => setView(v)}>
            {t(`leaveView.${v}`)}
          </Button>
        ))}
      </div>
      {view === 'requests' && <Requests />}
      {view === 'types' && <Types />}
      {view === 'balances' && <Balances />}
    </div>
  );
}

function Requests() {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<LeaveRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ page: String(page), limit: '25' });
    if (status) q.set('status', status);
    api
      .get<Page<LeaveRequest>>(`/hrms/leave/requests?${q.toString()}`)
      .then((d) => live && setData(d))
      .catch((e) => live && toast(errorText(e), 'error'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, version]);

  async function act(r: LeaveRequest, action: 'approve' | 'reject' | 'cancel', body: Record<string, unknown> = {}) {
    setBusy(r.id);
    try {
      await api.post(`/hrms/leave/requests/${r.id}/${action}`, body);
      toast(t(`leaveDone.${action}`), 'success');
      setRejecting(null);
      setNote('');
      setVersion((v) => v + 1);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Select
          label={t('colStatus')}
          value={status}
          placeholder={tCommon('all')}
          onChange={(e) => {
            setLoading(true);
            setStatus(e.target.value);
            setPage(1);
          }}
          options={LEAVE_STATUSES.map((s) => ({ value: s, label: t(`leaveStatus.${s}`) }))}
        />
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState title={t('noLeaveRequests')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('colName')}</th>
                <th className="px-4 py-2">{t('leaveType')}</th>
                <th className="px-4 py-2">{t('dates')}</th>
                <th className="px-4 py-2">{t('days')}</th>
                <th className="px-4 py-2">{t('reason')}</th>
                <th className="px-4 py-2">{t('colStatus')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.employee.name}</td>
                  <td className="px-4 py-2">
                    {r.leaveType.name}
                    {!r.leaveType.isPaid && (
                      <span className="ml-1">
                        <Badge variant="orange">{t('unpaid')}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {formatDateOnly(r.fromDate)}
                    {r.fromDate !== r.toDate && ` – ${formatDateOnly(r.toDate)}`}
                    {r.halfDay && <span className="ml-1 text-xs text-gray-500">{t('halfDay')}</span>}
                  </td>
                  <td className="px-4 py-2">{r.days}</td>
                  <td className="max-w-56 px-4 py-2 text-gray-600">
                    {r.reason}
                    {r.decisionNote && <div className="text-xs text-gray-400">{r.decisionNote}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_VARIANT[r.status]}>{t(`leaveStatus.${r.status}`)}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    {r.status === 'PENDING' && (
                      <>
                        <Button size="sm" loading={busy === r.id} onClick={() => act(r, 'approve')}>
                          {t('approve')}
                        </Button>{' '}
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(r)}>
                          {t('reject')}
                        </Button>
                      </>
                    )}
                    {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.confirm(t('confirmCancelLeave')) && act(r, 'cancel')}
                      >
                        {tCommon('cancel')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {tCommon('previous')}
          </Button>
          <span className="text-sm text-gray-500">{tCommon('pageOf', { page, total: totalPages })}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            {tCommon('next')}
          </Button>
        </div>
      )}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={t('rejectLeave')} size="sm">
        <div className="space-y-3">
          <Input label={t('rejectNote')} required maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" disabled={!note.trim()} loading={!!rejecting && busy === rejecting.id} onClick={() => rejecting && act(rejecting, 'reject', { note: note.trim() })}>
              {t('reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Types() {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [types, setTypes] = useState<LeaveType[] | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null);
  const [name, setName] = useState('');
  const [allowance, setAllowance] = useState('0');
  const [carry, setCarry] = useState('0');
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<LeaveType[]>('/hrms/leave/types?includeInactive=true')
      .then(setTypes)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  function open(x: LeaveType | 'new') {
    setEditing(x);
    setName(x === 'new' ? '' : x.name);
    setAllowance(x === 'new' ? '0' : String(x.yearlyAllowance));
    setCarry(x === 'new' ? '0' : String(x.carryForwardCap));
    setPaid(x === 'new' ? true : x.isPaid);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { name: name.trim(), yearlyAllowance: Number(allowance), carryForwardCap: Number(carry), isPaid: paid };
      if (editing === 'new') await api.post('/hrms/leave/types', body);
      else if (editing) await api.patch(`/hrms/leave/types/${editing.id}`, body);
      toast(t('leaveTypeSaved'), 'success');
      setEditing(null);
      setVersion((v) => v + 1);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(x: LeaveType) {
    try {
      await api.patch(`/hrms/leave/types/${x.id}`, { isActive: !x.isActive });
      setVersion((v) => v + 1);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  if (!types)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('leaveTypesTitle')}</h2>
          <p className="text-sm text-gray-500">{t('leaveTypesHelp')}</p>
        </div>
        <Button size="sm" onClick={() => open('new')}>
          {t('addLeaveType')}
        </Button>
      </div>
      <ul className="mt-4 divide-y divide-gray-100">
        {types.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <span>
              <span className={x.isActive ? 'font-medium text-gray-900' : 'text-gray-400'}>{x.name}</span>
              <span className="ml-3 text-gray-500">{t('leaveTypeLine', { days: x.yearlyAllowance, carry: x.carryForwardCap })}</span>
              <span className="ml-2">
                <Badge variant={x.isPaid ? 'green' : 'orange'}>{x.isPaid ? t('paid') : t('unpaid')}</Badge>
              </span>
              {!x.isActive && (
                <span className="ml-2">
                  <Badge variant="gray">{t('inactive')}</Badge>
                </span>
              )}
            </span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => open(x)}>
                {tCommon('edit')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(x)}>
                {x.isActive ? t('deactivate') : t('activate')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? t('addLeaveType') : t('editLeaveType')} size="sm">
        <div className="space-y-3">
          <Input label={t('leaveTypeName')} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={t('yearlyAllowance')} type="number" min="0" step="0.5" value={allowance} onChange={(e) => setAllowance(e.target.value)} />
          <Input label={t('carryForwardCap')} type="number" min="0" step="0.5" value={carry} onChange={(e) => setCarry(e.target.value)} helpText={t('carryHelp')} />
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            {t('paidLeave')}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={saving} disabled={!name.trim()} onClick={save}>
              {tCommon('save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Balances() {
  const t = useTranslations('hr');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<LeaveBalanceRow[] | null>(null);

  useEffect(() => {
    api
      .get<LeaveBalanceRow[]>('/hrms/leave/balances')
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rows)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  if (rows.length === 0) return <EmptyState title={t('noEmployees')} />;
  const types = rows[0].balances;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{types[0] ? t('balanceYear', { from: formatDateOnly(types[0].yearStart), to: formatDateOnly(types[0].yearEnd) }) : ''}</p>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">{t('colName')}</th>
              {types.map((b) => (
                <th key={b.leaveTypeId} className="px-4 py-2">
                  {b.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                {r.balances.map((b) => (
                  <td key={b.leaveTypeId} className="px-4 py-2" title={t('balanceTitle', { allowance: b.allowance, carried: b.carriedIn, used: b.used, pending: b.pending })}>
                    {b.isPaid ? t('balanceCell', { available: b.available, allowance: b.allowance + b.carriedIn }) : t('balanceUsed', { used: b.used })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
