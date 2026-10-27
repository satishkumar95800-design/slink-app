'use client';

import { Banknote, CalendarClock, HandCoins, Landmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { formatDateOnly, formatMonthYear, formatRupees } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { useLanguage } from '../../../lib/i18n/provider';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { Kpi } from '../components';
import type { RoyaltyBranch, RoyaltySummary, RoyaltyTerm } from '../types';

const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

function useTermText() {
  const t = useTranslations('headOffice.royalties');
  return (term: RoyaltyTerm | null) => {
    if (!term) return t('termsNone');
    if (term.mode === 'fixed') return t('termsFixed', { amount: formatRupees(term.fixedAmount) });
    return term.minimumAmount
      ? t('termsPercentMin', { percent: term.percent ?? 0, minimum: formatRupees(term.minimumAmount) })
      : t('termsPercent', { percent: term.percent ?? 0 });
  };
}

/** Royalty from each branch: terms, what is due from its fee collections, and payments received. */
export default function HeadOfficeRoyalties() {
  const t = useTranslations('headOffice.royalties');
  const errorText = useErrorText();
  const termText = useTermText();
  const [data, setData] = useState<RoyaltySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api
        .get<RoyaltySummary>('/head-office/royalties')
        .then(setData)
        .catch((e) => setError(errorText(e))),
    [errorText],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="mx-auto max-w-6xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data)
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const cols = ['colBranch', 'colTerms', 'colCollected', 'colDue', 'colReceived', 'colOutstanding', 'colLast'] as const;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <Kpi icon={<HandCoins className="h-4 w-4" />} label={t('kpiDue')} value={formatRupees(data.totals.dueThisMonth)} sub={t('kpiDueSub')} />
        <Kpi icon={<Banknote className="h-4 w-4" />} label={t('kpiReceived')} value={formatRupees(data.totals.receivedThisMonth)} />
        <Kpi icon={<CalendarClock className="h-4 w-4" />} label={t('kpiOutstanding')} value={formatRupees(data.totals.outstanding)} />
      </div>

      {data.branches.length === 0 ? (
        <EmptyState title={t('title')} description={t('noBranches')} />
      ) : (
        <section className="overflow-x-auto rounded-3xl border border-black/5 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-cream/60">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.branches.map((b) => (
                <tr
                  key={b.id}
                  tabIndex={0}
                  onClick={() => setOpen(b.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(b.id)}
                  className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">{b.name}</td>
                  <td className={`px-3 py-3 ${b.term ? 'text-gray-700' : 'font-semibold text-coral'}`}>{termText(b.term)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{formatRupees(b.thisMonth.collected)}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">{formatRupees(b.thisMonth.due)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{formatRupees(b.thisMonth.received)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 ${Number(b.outstanding) > 0 ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                    {formatRupees(b.outstanding)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-500">{b.lastReceivedOn ? formatDateOnly(b.lastReceivedOn) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {open && (
        <BranchRoyalty
          tenantId={open}
          onClose={() => setOpen(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function BranchRoyalty({ tenantId, onClose, onChanged }: { tenantId: string; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations('headOffice.royalties');
  const errorText = useErrorText();
  const termText = useTermText();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [b, setB] = useState<RoyaltyBranch | null>(null);
  const [form, setForm] = useState<'terms' | 'payment' | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RoyaltyBranch>(`/head-office/royalties/${tenantId}`)
      .then(setB)
      .catch((e) => toast(errorText(e), 'error'));
  }, [tenantId, errorText, toast]);

  async function submit(path: string, body: object, method: 'put' | 'post' = 'post') {
    setBusy(true);
    setFormError(null);
    try {
      const next = await (method === 'put' ? api.put<RoyaltyBranch>(path, body) : api.post<RoyaltyBranch>(path, body));
      setB(next);
      setForm(null);
      onChanged();
      toast(t('saved'), 'success');
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function onTerms(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const mode = f.get('mode') as 'percent' | 'fixed';
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : undefined);
    void submit(
      `/head-office/royalties/${tenantId}/terms`,
      mode === 'percent'
        ? { mode, percent: num('percent'), minimumAmount: num('minimumAmount'), effectiveFrom: f.get('effectiveFrom') }
        : { mode, fixedAmount: num('fixedAmount'), effectiveFrom: f.get('effectiveFrom') },
      'put',
    );
  }

  function onPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void submit(`/head-office/royalties/${tenantId}/payments`, {
      month: f.get('month'),
      amount: Number(f.get('amount')),
      receivedOn: f.get('receivedOn'),
      reference: f.get('reference') || undefined,
      note: f.get('note') || undefined,
    });
  }

  async function voidPayment(id: string) {
    const reason = window.prompt(t('voidReason'));
    if (!reason?.trim()) return;
    await submit(`/head-office/royalty-payments/${id}/void`, { reason: reason.trim() });
  }

  const monthName = (m: string) => formatMonthYear(m, language);

  return (
    <Drawer open onClose={onClose} title={b?.name ?? '…'} subtitle={b ? termText(b.terms[0] ?? null) : undefined} icon={<Landmark className="h-5 w-5" />}>
      {!b ? (
        <div className="flex justify-center p-10">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={form === 'terms' ? 'primary' : 'secondary'} onClick={() => setForm(form === 'terms' ? null : 'terms')}>
              {t('setTerms')}
            </Button>
            <Button size="sm" variant={form === 'payment' ? 'primary' : 'secondary'} onClick={() => setForm(form === 'payment' ? null : 'payment')}>
              {t('recordPayment')}
            </Button>
          </div>

          {form === 'terms' && <TermsForm month={b.month} current={b.terms[0] ?? null} busy={busy} onSubmit={onTerms} onCancel={() => setForm(null)} />}
          {form === 'payment' && (
            <form onSubmit={onPayment} className="space-y-3 rounded-2xl bg-cream/60 p-4">
              <Input label={t('month')} name="month" type="month" required max={b.month} defaultValue={b.months.find((m) => Number(m.balance) > 0)?.month ?? b.month} />
              <Input label={t('amount')} name="amount" type="number" min="1" step="0.01" required />
              <Input label={t('receivedOn')} name="receivedOn" type="date" required max={todayYmd()} defaultValue={todayYmd()} />
              <Input label={t('reference')} name="reference" maxLength={100} />
              <Input label={t('note')} name="note" maxLength={300} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={busy}>
                  {t('save')}
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setForm(null)}>
                  {t('cancel')}
                </Button>
              </div>
            </form>
          )}
          {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <section>
            <h3 className="text-sm font-semibold text-gray-900">{t('statement')}</h3>
            <p className="text-xs text-gray-500">{t('statementHelp')}</p>
            {b.months.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">{t('termsNone')}</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="py-2 pr-3">{t('colMonth')}</th>
                      <th className="py-2 pr-3">{t('colCollected')}</th>
                      <th className="py-2 pr-3">{t('colDue')}</th>
                      <th className="py-2 pr-3">{t('colReceived')}</th>
                      <th className="py-2">{t('colBalance')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {b.months.map((m) => (
                      <tr key={m.month}>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-900">{monthName(m.month)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{formatRupees(m.collected)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-gray-900">{formatRupees(m.due)}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-gray-600">{formatRupees(m.received)}</td>
                        <td className={`whitespace-nowrap py-2 ${Number(m.balance) > 0 ? 'font-semibold text-red-700' : 'text-gray-600'}`}>{formatRupees(m.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900">{t('payments')}</h3>
            {b.payments.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500">{t('paymentsNone')}</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                    <div className={p.voided ? 'text-gray-400 line-through' : 'text-gray-800'}>
                      <p className="font-semibold">
                        {formatRupees(p.amount)} · {monthName(p.month)}
                      </p>
                      <p className="text-xs">
                        {formatDateOnly(p.receivedOn)}
                        {p.reference && ` · ${p.reference}`}
                        {p.note && ` · ${p.note}`}
                      </p>
                      {p.voided && <p className="text-xs no-underline">{t('voided', { reason: p.voidReason ?? '' })}</p>}
                    </div>
                    {!p.voided && (
                      <button type="button" className="text-xs font-semibold text-red-600 hover:underline" onClick={() => voidPayment(p.id)}>
                        {t('void')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {b.terms.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-900">{t('termsHistory')}</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {b.terms.map((term) => (
                  <li key={term.id}>
                    {monthName(term.effectiveFrom)}: {termText(term)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function TermsForm({
  month,
  current,
  busy,
  onSubmit,
  onCancel,
}: {
  month: string;
  current: RoyaltyTerm | null;
  busy: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('headOffice.royalties');
  const [mode, setMode] = useState<'percent' | 'fixed'>(current?.mode ?? 'percent');
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl bg-cream/60 p-4">
      <Select
        label={t('mode')}
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as 'percent' | 'fixed')}
        options={[
          { value: 'percent', label: t('modePercent') },
          { value: 'fixed', label: t('modeFixed') },
        ]}
      />
      {mode === 'percent' ? (
        <>
          <Input label={t('percent')} name="percent" type="number" min="0.01" max="100" step="0.01" required defaultValue={current?.percent ?? undefined} />
          <Input label={t('minimumAmount')} name="minimumAmount" type="number" min="0" step="0.01" defaultValue={current?.minimumAmount ?? undefined} />
        </>
      ) : (
        <Input label={t('fixedAmount')} name="fixedAmount" type="number" min="1" step="0.01" required defaultValue={current?.fixedAmount ?? undefined} />
      )}
      <Input label={t('effectiveFrom')} name="effectiveFrom" type="month" required defaultValue={month} helpText={t('termsHelp')} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy}>
          {t('save')}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
