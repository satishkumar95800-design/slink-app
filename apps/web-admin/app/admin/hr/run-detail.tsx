'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateTime, formatMonthYear, formatRupees } from '../../../lib/format';
import { useLanguage } from '../../../lib/i18n/provider';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { RUN_VARIANT } from './payroll-tab';
import { LineDetail, LineSummary, PayRunDetail } from './types';

type Action = 'submit' | 'reopen' | 'approve' | 'lock' | 'cancel' | 'mark-paid' | 'regenerate';

export function RunDetail({ id, isAdmin, onBack }: { id: string; isAdmin: boolean; onBack: () => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [run, setRun] = useState<PayRunDetail | null>(null);
  const [lineId, setLineId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<PayRunDetail>(`/hrms/payroll/runs/${id}`)
      .then(setRun)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(load, [load]);

  async function perform(action: Action) {
    setBusy(true);
    try {
      const body = action === 'cancel' ? { reason: text.trim() } : action === 'mark-paid' ? { reference: text.trim() } : {};
      const res = await api.post<PayRunDetail>(`/hrms/payroll/runs/${id}/${action}`, body);
      setRun(res);
      if (action === 'regenerate' && res.skipped?.length) toast(t('generatedSkipped', { count: res.skipped.length }), 'success');
      else toast(t(`runDone.${action}`), 'success');
      setConfirm(null);
      setText('');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function download(path: string, name: string) {
    try {
      await apiDownload(path, name);
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  if (!run)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );

  const st = run.status;
  const editable = st === 'DRAFT';
  const actions: { action: Action; label: string; variant?: 'secondary' | 'danger'; show: boolean }[] = [
    { action: 'regenerate', label: t('actRegenerate'), variant: 'secondary', show: st === 'DRAFT' },
    { action: 'submit', label: t('actSubmit'), show: st === 'DRAFT' },
    { action: 'reopen', label: t('actReopen'), variant: 'secondary', show: st === 'REVIEW' || (st === 'APPROVED' && isAdmin) },
    { action: 'approve', label: t('actApprove'), show: st === 'REVIEW' && isAdmin },
    { action: 'lock', label: t('actLock'), show: st === 'APPROVED' && isAdmin },
    { action: 'mark-paid', label: t('actMarkPaid'), show: st === 'LOCKED' && !run.paidAt },
    { action: 'cancel', label: t('actCancel'), variant: 'danger', show: st !== 'LOCKED' && st !== 'CANCELLED' },
  ];
  const needsText = confirm === 'cancel' || confirm === 'mark-paid';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          {tCommon('back')}
        </Button>
        <h2 className="text-lg font-extrabold text-gray-900">{formatMonthYear(run.month, language)}</h2>
        <Badge variant={RUN_VARIANT[st]}>{t(`runStatus.${st}`)}</Badge>
        {run.selfApproved && <Badge variant="orange">{t('selfApproved')}</Badge>}
        {run.paidAt && <Badge variant="green">{t('paidOn', { date: formatDateTime(run.paidAt) })}</Badge>}
      </div>

      {run.totals && (
        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              [t('employeesCount'), String(run.totals.employees)],
              [t('gross'), formatRupees(run.totals.gross)],
              [t('deductions'), formatRupees(run.totals.deductions)],
              [t('netPay'), formatRupees(run.totals.net)],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{k}</p>
              <p className="text-lg font-bold text-gray-900">{v}</p>
            </div>
          ))}
        </div>
      )}
      {run.paymentReference && <p className="text-sm text-gray-600">{t('paymentReference', { ref: run.paymentReference })}</p>}
      {run.cancelReason && <p className="text-sm text-red-700">{t('cancelledBecause', { reason: run.cancelReason })}</p>}
      {st === 'LOCKED' && <p className="text-xs text-gray-500">{t('lockedNote')}</p>}

      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => a.show)
          .map((a) => (
            <Button key={a.action} size="sm" variant={a.variant} onClick={() => setConfirm(a.action)}>
              {a.label}
            </Button>
          ))}
        {st !== 'CANCELLED' && (
          <Button size="sm" variant="secondary" onClick={() => download(`/hrms/payroll/runs/${id}/register-csv`, `salary-register-${run.month}.csv`)}>
            {t('registerCsv')}
          </Button>
        )}
        {st === 'LOCKED' && (
          <Button size="sm" variant="secondary" onClick={() => download(`/hrms/payroll/runs/${id}/bank-csv`, `bank-transfer-${run.month}.csv`)}>
            {t('bankCsv')}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">{t('colName')}</th>
              <th className="px-4 py-2">{t('lopDays')}</th>
              <th className="px-4 py-2">{t('gross')}</th>
              <th className="px-4 py-2">{t('deductions')}</th>
              <th className="px-4 py-2">{t('netPay')}</th>
              <th className="px-4 py-2">{t('flagsCol')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {run.lines.map((l: LineSummary) => (
              <tr key={l.id} className="cursor-pointer hover:bg-teal/5" onClick={() => setLineId(l.id)}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  {l.employeeName}
                  <span className="ml-2 font-mono text-xs text-gray-400">{l.employeeCode}</span>
                </td>
                <td className="px-4 py-2">{l.lopDays}</td>
                <td className="px-4 py-2">{formatRupees(l.gross)}</td>
                <td className="px-4 py-2">{formatRupees(l.deductions)}</td>
                <td className="px-4 py-2 font-semibold">{formatRupees(l.net)}</td>
                <td className="px-4 py-2">
                  <span className="flex flex-wrap gap-1">
                    {l.flags.map((f) => (
                      <Badge key={f} variant="orange">
                        {t(`flag.${f as 'UNMARKED_DAYS'}`)}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      void download(`/hrms/payroll/runs/${id}/lines/${l.id}/payslip`, `payslip-${l.employeeCode}-${run.month}.pdf`);
                    }}
                  >
                    {t('payslip')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lineId && <LineModal runId={id} lineId={lineId} editable={editable} onClose={() => setLineId(null)} onChanged={load} />}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? t(`actionTitle.${confirm}`) : ''} size="sm">
        {confirm && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{t(`actionConfirm.${confirm}`)}</p>
            {needsText && (
              <Input label={confirm === 'cancel' ? t('cancelReason') : t('bankReference')} required maxLength={confirm === 'cancel' ? 300 : 100} value={text} onChange={(e) => setText(e.target.value)} />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {tCommon('cancel')}
              </Button>
              <Button variant={confirm === 'cancel' ? 'danger' : undefined} loading={busy} disabled={needsText && !text.trim()} onClick={() => perform(confirm)}>
                {tCommon('confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LineModal({ runId, lineId, editable, onClose, onChanged }: { runId: string; lineId: string; editable: boolean; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [line, setLine] = useState<LineDetail | null>(null);
  const [type, setType] = useState('ALLOWANCE');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<LineDetail>(`/hrms/payroll/runs/${runId}/lines/${lineId}`)
      .then(setLine)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, lineId]);

  async function add() {
    setBusy(true);
    try {
      const res = await api.post<LineDetail>(`/hrms/payroll/runs/${runId}/lines/${lineId}/adjustments`, { type, name: name.trim(), amount: Number(amount), reason: reason.trim() });
      setLine(res);
      setName('');
      setAmount('');
      setReason('');
      toast(t('adjustmentAdded'), 'success');
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(itemId: string) {
    try {
      const res = await api.delete<LineDetail>(`/hrms/payroll/runs/${runId}/lines/${lineId}/adjustments/${itemId}`);
      setLine(res);
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const rows = (kind: 'EARNING' | 'DEDUCTION') => line?.items.filter((i) => i.kind === kind) ?? [];
  return (
    <Modal open onClose={onClose} title={line ? line.employeeName : ''} size="xl">
      {!line ? (
        <Spinner className="h-6 w-6 text-teal" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('lineMeta', { period: line.periodDays, lop: line.lopDays, paid: line.paidDays, unmarked: line.unmarkedDays })}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['EARNING', 'DEDUCTION'] as const).map((kind) => (
              <div key={kind} className="rounded-2xl border border-gray-100 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">{kind === 'EARNING' ? t('earnings') : t('deductions')}</h3>
                <ul className="mt-2 divide-y divide-gray-100 text-sm">
                  {rows(kind).map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 py-1">
                      <span>
                        {i.name}
                        {i.source === 'ADJUSTMENT' && <span className="ml-1 text-xs text-orange-700">{t('adjustmentTag')}</span>}
                        {i.reason && <span className="block text-xs text-gray-400">{i.reason}</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        {formatRupees(i.amount)}
                        {editable && i.source === 'ADJUSTMENT' && (
                          <Button size="sm" variant="ghost" onClick={() => remove(i.id)}>
                            {tCommon('remove')}
                          </Button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
                  <span>{kind === 'EARNING' ? t('gross') : t('deductions')}</span>
                  <span>{formatRupees(kind === 'EARNING' ? line.gross : line.deductions)}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="text-right text-base font-extrabold text-gray-900">
            {t('netPay')} {formatRupees(line.net)}
          </p>
          <p className="text-xs text-gray-500">{t('employerContributions', { pf: formatRupees(line.employerPf), esi: formatRupees(line.employerEsi) })}</p>

          {editable ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">{t('addAdjustment')}</h3>
              <p className="text-xs text-gray-500">{t('adjustmentHelp')}</p>
              <div className="mt-2 grid items-end gap-2 sm:grid-cols-4">
                <Select label={t('adjustmentType')} value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'ALLOWANCE', label: t('allowance') }, { value: 'DEDUCTION', label: t('deduction') }]} />
                <Input label={t('componentName')} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                <Input label={t('amountRupees')} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Input label={t('reason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" loading={busy} disabled={!name.trim() || !(Number(amount) > 0) || !reason.trim()} onClick={add}>
                  {tCommon('add')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">{t('linesReadOnly')}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
