'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Check, Printer } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { formatDateOnly, formatDateTime, formatRupees } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import { DeskData, DeskPayment, FOLLOW_UP_KINDS, PAYMENT_MODES, PAYMENT_PURPOSES, todayYmd } from '../reception/types';

/** Only admin and accounts void a desk receipt (the API checks too). */
const CAN_VOID = ['admin', 'accounts', 'super_admin'];

/**
 * The front desk's part of an enquiry: follow-up to-dos ticked off when done,
 * the documents received, money taken at the desk, and calls.
 */
export function DeskPanel({ enquiryId, onChanged }: { enquiryId: string; onChanged: () => void }) {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [data, setData] = useState<DeskData | null>(null);
  const [busy, setBusy] = useState(false);
  const [fu, setFu] = useState({ dueOn: todayYmd(), kind: 'call', note: '' });
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const [pay, setPay] = useState({ purpose: 'registration_fee', amount: '', mode: 'cash', reference: '' });
  const [voiding, setVoiding] = useState<DeskPayment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const role = getSession()?.role as string | undefined;

  const load = useCallback(() => {
    api
      .get<DeskData>(`/reception/enquiries/${enquiryId}`)
      .then(setData)
      .catch((e) => toast(errorText(e), 'error'));
  }, [enquiryId, errorText, toast]);

  useEffect(load, [load]);

  async function run<T>(fn: () => Promise<T>, done: string, after?: (r: T) => void) {
    setBusy(true);
    try {
      const r = await fn();
      after?.(r);
      toast(done, 'success');
      onChanged();
      return true;
    } catch (e) {
      toast(errorText(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const amountOk = /^\d{1,7}(\.\d{1,2})?$/.test(pay.amount) && Number(pay.amount) > 0;

  return (
    <>
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">{t('followUps')}</h3>
        <ul className="mt-3 space-y-2">
          {data.followUps.length === 0 && <li className="text-sm text-gray-500">{t('noFollowUps')}</li>}
          {data.followUps.map((f) => (
            <li key={f.id} className="rounded-xl border border-gray-100 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-teal"
                  checked={f.done}
                  disabled={busy}
                  onChange={() => {
                    if (f.done)
                      void run(() => api.post<DeskData>(`/reception/follow-ups/${f.id}/reopen`, {}), t('followUpReopened'), setData);
                    else {
                      setOutcomeFor(f.id);
                      setOutcome('');
                    }
                  }}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className={`font-semibold ${f.done ? 'text-gray-400 line-through' : f.overdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {t(`kinds.${f.kind}`)} · {formatDateOnly(f.dueOn)}
                  </span>
                  {f.note && <span className="block text-gray-600">{f.note}</span>}
                  {f.done && (
                    <span className="block text-xs text-gray-500">
                      {t('doneBy', { name: f.doneBy ?? '', date: formatDateTime(f.doneAt!) })}
                      {f.outcome ? ` — ${f.outcome}` : ''}
                    </span>
                  )}
                </span>
              </label>
              {outcomeFor === f.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2 pl-8">
                  <div className="min-w-48 flex-1">
                    <Input label={t('outcome')} maxLength={500} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={t('outcomePlaceholder')} autoFocus />
                  </div>
                  <Button
                    size="sm"
                    loading={busy}
                    onClick={async () => {
                      if (
                        await run(
                          () => api.post<DeskData>(`/reception/follow-ups/${f.id}/done`, { outcome: outcome.trim() || undefined }),
                          t('followUpDone'),
                          setData,
                        )
                      )
                        setOutcomeFor(null);
                    }}
                  >
                    <Check className="h-4 w-4" /> {t('markDone')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setOutcomeFor(null)}>
                    {t('cancel')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_8rem_1fr_auto] sm:items-end">
          <Input label={t('dueOn')} type="date" min={todayYmd()} value={fu.dueOn} onChange={(e) => setFu({ ...fu, dueOn: e.target.value })} />
          <Select label={t('kind')} value={fu.kind} onChange={(e) => setFu({ ...fu, kind: e.target.value })} options={FOLLOW_UP_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
          <Input label={t('note')} maxLength={500} value={fu.note} onChange={(e) => setFu({ ...fu, note: e.target.value })} placeholder={t('followUpNotePlaceholder')} />
          <Button
            size="sm"
            disabled={!fu.dueOn || busy}
            onClick={async () => {
              if (
                await run(
                  () => api.post<DeskData>(`/reception/enquiries/${enquiryId}/follow-ups`, { ...fu, note: fu.note.trim() || undefined }),
                  t('followUpAdded'),
                  setData,
                )
              )
                setFu({ dueOn: todayYmd(), kind: 'call', note: '' });
            }}
          >
            {t('addFollowUp')}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">{t('documents')}</h3>
          <span className="text-xs text-gray-500">
            {t('documentsCount', { received: data.documents.filter((d) => d.received).length, total: data.documents.length })}
          </span>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.documents.map((d) => (
            <li key={d.kind}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 p-2.5 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 accent-teal"
                  checked={d.received}
                  disabled={busy}
                  onChange={() =>
                    void run(
                      () => api.put<DeskData>(`/reception/enquiries/${enquiryId}/documents/${d.kind}`, { received: !d.received }),
                      d.received ? t('documentPending') : t('documentReceived'),
                      setData,
                    )
                  }
                />
                <span>
                  <span className="font-medium text-gray-900">{t(`docs.${d.kind}`)}</span>
                  {d.received && d.receivedAt && (
                    <span className="block text-xs text-gray-500">{t('receivedOn', { date: formatDateOnly(d.receivedAt), name: d.receivedBy ?? '' })}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">{t('deskPayments')}</h3>
        <ul className="mt-3 space-y-2">
          {data.payments.length === 0 && <li className="text-sm text-gray-500">{t('noPayments')}</li>}
          {data.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3 text-sm">
              <span>
                <span className={`font-semibold ${p.void ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {t('receiptNo', { no: p.receiptNo })} · {formatRupees(p.amount)}
                </span>
                <span className="block text-xs text-gray-500">
                  {t(`purposes.${p.purpose}`)} · {t(`modes.${p.mode}`)} · {formatDateOnly(p.receivedOn)} · {p.receivedBy}
                </span>
                {p.void && <span className="block text-xs text-red-600">{t('voidedBecause', { reason: p.void.reason ?? '' })}</span>}
              </span>
              <span className="flex gap-1">
                <a
                  href={`/admin/reception/receipt/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-teal hover:bg-teal/10"
                >
                  <Printer className="h-3.5 w-3.5" /> {t('print')}
                </a>
                {!p.void && role && CAN_VOID.includes(role) && (
                  <Button size="sm" variant="ghost" onClick={() => setVoiding(p)}>
                    {t('void')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {voiding && (
          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-red-50 p-3">
            <div className="min-w-56 flex-1">
              <Input label={t('voidReason', { no: voiding.receiptNo })} required maxLength={200} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </div>
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              disabled={voidReason.trim().length < 3}
              onClick={async () => {
                if (await run(() => api.post(`/reception/payments/${voiding.id}/void`, { reason: voidReason.trim() }), t('voided'))) {
                  setVoiding(null);
                  setVoidReason('');
                  load();
                }
              }}
            >
              {t('void')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVoiding(null)}>
              {t('cancel')}
            </Button>
          </div>
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Select label={t('purpose')} value={pay.purpose} onChange={(e) => setPay({ ...pay, purpose: e.target.value })} options={PAYMENT_PURPOSES.map((p) => ({ value: p, label: t(`purposes.${p}`) }))} />
          <Input label={t('amount')} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value.trim() })} placeholder="500" />
          <Select label={t('mode')} value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })} options={PAYMENT_MODES.map((m) => ({ value: m, label: t(`modes.${m}`) }))} />
          <Input label={t('reference')} maxLength={60} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder={t('referencePlaceholder')} />
        </div>
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!amountOk || busy}
            onClick={async () => {
              await run(
                () =>
                  api.post<DeskPayment>(`/reception/enquiries/${enquiryId}/payments`, {
                    purpose: pay.purpose,
                    amount: pay.amount,
                    mode: pay.mode,
                    reference: pay.reference.trim() || undefined,
                  }),
                t('paymentRecorded'),
                (r) => {
                  setPay({ purpose: 'registration_fee', amount: '', mode: 'cash', reference: '' });
                  window.open(`/admin/reception/receipt/${r.id}`, '_blank', 'noreferrer');
                  load();
                },
              );
            }}
          >
            {t('recordPayment')}
          </Button>
        </div>
      </section>

      {data.calls.length > 0 && (
        <section className="rounded-2xl border border-black/5 bg-white p-4">
          <h3 className="text-sm font-bold text-gray-900">{t('calls')}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.calls.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <Badge variant={c.direction === 'incoming' ? 'blue' : 'purple'}>{t(`directions.${c.direction}`)}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="text-gray-900">{c.note || c.purpose || c.phone}</span>
                  <span className="block text-xs text-gray-500">{formatDateTime(c.at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
