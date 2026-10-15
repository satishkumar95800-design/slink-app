'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import type { EntryModalRequest } from './entry-modal';
import { Entry, EntryPage, ENTRY_STATUSES, ENTRY_TYPES, STATUS_VARIANT, TYPE_VARIANT } from './types';
import type { PettyLookups } from './use-lookups';

interface Props {
  lookups: PettyLookups;
  version: number;
  onAction: (r: EntryModalRequest) => void;
  onChanged: () => void;
}

const PAGE_SIZE = 25;

export function LedgerTab({ lookups, version, onAction, onChanged }: Props) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [person, setPerson] = useState(''); // "u:<id>" or "p:<id>"
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EntryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Entry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  function query(withPaging: boolean): string {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (type) q.set('type', type);
    if (status) q.set('status', status);
    if (categoryId) q.set('categoryId', categoryId);
    if (person.startsWith('u:')) q.set('recipientUserId', person.slice(2));
    if (person.startsWith('p:')) q.set('payeeId', person.slice(2));
    if (withPaging) {
      q.set('page', String(page));
      q.set('limit', String(PAGE_SIZE));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  }

  const requestId = useRef(0);

  function load() {
    // Keeps showing the previous rows while the next page loads; only the first load shows the spinner.
    const mine = ++requestId.current;
    api
      .get<EntryPage>(`/petty-cash/entries${query(true)}`)
      .then((res) => {
        if (mine !== requestId.current) return;
        setData(res);
        setError(null);
      })
      .catch((e) => mine === requestId.current && setError(errorText(e)))
      .finally(() => mine === requestId.current && setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, type, status, categoryId, person, page, version]);

  function setFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  async function viewReceipt(entry: Entry) {
    try {
      const { url } = await api.get<{ url: string }>(`/petty-cash/entries/${entry.id}/receipt-url`);
      window.open(url, '_blank');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function exportCsv() {
    try {
      await apiDownload(`/petty-cash/export${query(false)}`, 'petty-cash-ledger.csv');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function confirmVoid() {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      await api.post(`/petty-cash/entries/${voidTarget.id}/void`, { reason: voidReason.trim() });
      toast(t('voided'), 'success');
      setVoidTarget(null);
      setVoidReason('');
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setVoiding(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const personOptions = [
    ...lookups.staff.map((s) => ({ value: `u:${s.id}`, label: s.name })),
    ...lookups.payees.map((p) => ({ value: `p:${p.id}`, label: `${p.name} (${t(`payeeType.${p.type}`)})` })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onAction({ type: 'TOP_UP' })}>
          {t('actionTopUp')}
        </Button>
        <Button size="sm" onClick={() => onAction({ type: 'DISBURSEMENT' })}>
          {t('actionDisburse')}
        </Button>
        <Button size="sm" onClick={() => onAction({ type: 'EXPENSE' })}>
          {t('actionExpense')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onAction({ type: 'RETURN' })}>
          {t('actionReturn')}
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" onClick={exportCsv}>
          {t('exportCsv')}
        </Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        <Input label={t('filterFrom')} type="date" value={from} onChange={(e) => setFilter(setFrom)(e.target.value)} />
        <Input label={t('filterTo')} type="date" value={to} min={from || undefined} onChange={(e) => setFilter(setTo)(e.target.value)} />
        <Select
          label={t('filterType')}
          value={type}
          onChange={(e) => setFilter(setType)(e.target.value)}
          placeholder={tCommon('all')}
          options={ENTRY_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        />
        <Select
          label={t('filterStatus')}
          value={status}
          onChange={(e) => setFilter(setStatus)(e.target.value)}
          placeholder={tCommon('all')}
          options={ENTRY_STATUSES.map((v) => ({ value: v, label: t(`status.${v}`) }))}
        />
        <Select
          label={t('filterCategory')}
          value={categoryId}
          onChange={(e) => setFilter(setCategoryId)(e.target.value)}
          placeholder={tCommon('all')}
          options={lookups.categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          label={t('filterPerson')}
          value={person}
          onChange={(e) => setFilter(setPerson)(e.target.value)}
          placeholder={tCommon('all')}
          options={personOptions}
        />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState title={t('emptyLedger')} description={t('emptyLedgerHelp')} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-cream/60">
                <tr>
                  {[t('colDate'), t('colType'), t('colDescription'), t('colRecipient'), t('colAmount'), t('colStatus'), t('colBy'), ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map((e) => (
                  <tr key={e.id} className={`transition-colors hover:bg-gray-50 ${e.status === 'VOIDED' || e.status === 'REJECTED' ? 'text-gray-400' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">{formatDateOnly(e.date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={TYPE_VARIANT[e.type]}>{t(`type.${e.type}`)}</Badge>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm">
                      <p className={e.status === 'VOIDED' ? 'line-through' : ''}>{e.description}</p>
                      {e.category && <p className="text-xs text-gray-500">{e.category.name}</p>}
                      {e.settlesEntryId && <p className="text-xs text-gray-500">{t('settlesAdvance')}</p>}
                      {e.rejectionReason && <p className="text-xs text-red-600">{t('reasonLine', { reason: e.rejectionReason })}</p>}
                      {e.voidReason && <p className="text-xs text-gray-500">{t('reasonLine', { reason: e.voidReason })}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{e.recipient?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold">{formatRupees(e.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[e.status]}>{t(`status.${e.status}`)}</Badge>
                      {e.reviewedBy && <p className="mt-1 text-xs text-gray-500">{t('reviewedBy', { name: e.reviewedBy.name })}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{e.createdBy.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {e.hasReceipt && (
                        <Button variant="ghost" size="sm" onClick={() => viewReceipt(e)}>
                          {t('viewReceipt')}
                        </Button>
                      )}
                      {(e.status === 'APPROVED' || e.status === 'PENDING') && (
                        <Button variant="ghost" size="sm" onClick={() => setVoidTarget(e)}>
                          {t('void')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {tCommon('previous')}
              </Button>
              <span className="text-sm text-gray-500">{tCommon('pageOf', { page, total: totalPages })}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                {tCommon('next')}
              </Button>
            </div>
          )}
        </>
      )}

      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title={t('voidTitle')}>
        {voidTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t('voidHelp', { amount: formatRupees(voidTarget.amount), description: voidTarget.description })}
            </p>
            <Input label={t('voidReason')} required maxLength={500} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVoidTarget(null)}>
                {tCommon('cancel')}
              </Button>
              <Button variant="danger" loading={voiding} disabled={voidReason.trim().length < 3} onClick={confirmVoid}>
                {t('voidConfirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
