'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees, toAmount } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import { roleLabel } from '../../../lib/i18n/labels';
import { NotesFields, notesNetPaise } from './denominations';
import type { Advance, CashInHand, CashNotes, EntryType, NoteCounts, Settings } from './types';
import { todayYmd } from './types';
import type { PettyLookups } from './use-lookups';

export interface EntryModalRequest {
  type: EntryType;
  /** Preselects the advance being settled. */
  advanceId?: string;
}

type RecipientKind = 'user' | 'payee';

interface Props {
  request: EntryModalRequest;
  lookups: PettyLookups;
  settings: Settings | null;
  onClose: () => void;
  onSaved: () => void;
}

const TITLE_KEY = {
  TOP_UP: 'formTopUp',
  DISBURSEMENT: 'formDisburse',
  EXPENSE: 'formExpense',
  RETURN: 'formReturn',
} as const;

/** One form for the four entry types: top-up, cash given, expense and cash returned. */
export function EntryModal({ request, lookups, settings, onClose, onSaved }: Props) {
  const t = useTranslations('pettyCash');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const { type } = request;
  const fileRef = useRef<HTMLInputElement>(null);

  const [advances, setAdvances] = useState<Advance[]>([]);
  const [advanceId, setAdvanceId] = useState(request.advanceId ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [kind, setKind] = useState<RecipientKind>('user');
  const [recipientId, setRecipientId] = useState('');
  const [receiptKey, setReceiptKey] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<CashNotes>({ in: {}, out: {} });
  const [inHand, setInHand] = useState<NoteCounts | null>(null);

  const needsAdvance = type === 'RETURN';
  const mayAdvance = type === 'EXPENSE' || type === 'RETURN';
  useEffect(() => {
    if (!mayAdvance) return;
    api
      .get<Advance[]>('/petty-cash/advances?status=open')
      .then((list) => {
        setAdvances(list);
        // Opened from an advance's row: start from what is still open on it.
        const preselected = list.find((a) => a.id === request.advanceId);
        if (preselected) setAmount((prev) => prev || preselected.outstanding);
      })
      .catch(() => {});
  }, [mayAdvance, request.advanceId]);

  function chooseAdvance(id: string) {
    setAdvanceId(id);
    const picked = advances.find((a) => a.id === id);
    if (picked) setAmount(picked.outstanding);
  }

  const tracking = !!settings?.trackDenominations;
  useEffect(() => {
    if (!tracking) return;
    api
      .get<CashInHand>('/petty-cash/cash-in-hand')
      .then((c) => setInHand(Object.fromEntries(c.notes.map((n) => [String(n.value), n.count]))))
      .catch(() => {});
  }, [tracking]);

  const amountNum = toAmount(amount);
  const threshold = settings ? toAmount(settings.approvalThreshold) : null;
  const receiptLimit = settings ? toAmount(settings.receiptRequiredAbove) : null;
  const needsApproval = threshold !== null && amountNum > threshold;
  const receiptRequired = type === 'EXPENSE' && receiptLimit !== null && amountNum > receiptLimit;

  // Which way cash moves through the box; an expense paid from an advance moves none.
  const direction: 'in' | 'out' | null =
    type === 'TOP_UP' || type === 'RETURN' ? 'in' : type === 'DISBURSEMENT' || (type === 'EXPENSE' && !advanceId) ? 'out' : null;
  const askNotes = tracking && direction !== null;
  const amountPaise = Math.round(amountNum * 100);
  const notesMoved = direction === 'out' ? -notesNetPaise(notes) : notesNetPaise(notes);
  const notesOk = !askNotes || notesMoved === amountPaise;

  const activeCategories = lookups.categories.filter((c) => c.isActive);
  const activePayees = lookups.payees.filter((p) => p.isActive);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiUpload<{ key: string }>('/petty-cash/receipts', file);
      setReceiptKey(res.key);
      setReceiptName(file.name);
    } catch (err) {
      toast(errorText(err, t('receiptUploadFailed')), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const valid =
    amountNum > 0 &&
    !!date &&
    description.trim().length > 0 &&
    (type !== 'DISBURSEMENT' || !!recipientId) &&
    (type !== 'EXPENSE' || !!categoryId) &&
    (!needsAdvance || !!advanceId) &&
    (!receiptRequired || !!receiptKey) &&
    notesOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    try {
      const entry = await api.post<{ status: string }>('/petty-cash/entries', {
        type,
        amount: amountNum,
        date,
        description: description.trim(),
        ...(categoryId && (type === 'EXPENSE' || type === 'DISBURSEMENT') ? { categoryId } : {}),
        ...(type === 'DISBURSEMENT' ? (kind === 'user' ? { recipientUserId: recipientId } : { payeeId: recipientId }) : {}),
        ...(advanceId && mayAdvance ? { settlesEntryId: advanceId } : {}),
        ...(receiptKey ? { receiptKey } : {}),
        ...(askNotes ? { denominations: notes } : {}),
      });
      toast(entry.status === 'PENDING' ? t('submittedForApproval') : t('saved'), 'success');
      onSaved();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  const advanceLabel = (a: Advance) =>
    t('advanceOption', {
      person: a.recipient?.name ?? '',
      outstanding: formatRupees(a.outstanding),
      date: formatDateOnly(a.date),
    });

  return (
    <Modal open onClose={onClose} title={t(TITLE_KEY[type])} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {mayAdvance && (
          <Select
            label={needsAdvance ? t('advance') : t('settlesLabel')}
            required={needsAdvance}
            value={advanceId}
            onChange={(e) => chooseAdvance(e.target.value)}
            placeholder={needsAdvance ? t('selectAdvance') : t('directExpense')}
            options={advances.map((a) => ({ value: a.id, label: advanceLabel(a) }))}
          />
        )}

        {type === 'DISBURSEMENT' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('givenTo')}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as RecipientKind);
                setRecipientId('');
              }}
              options={[
                { value: 'user', label: t('staffKind') },
                { value: 'payee', label: t('payeeKind') },
              ]}
            />
            <Select
              label={kind === 'user' ? t('staffMember') : t('payee')}
              required
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder={kind === 'user' ? t('selectStaff') : t('selectPayee')}
              options={
                kind === 'user'
                  ? lookups.staff.map((s) => ({ value: s.id, label: `${s.name} (${roleLabel(tRoles, s.role)})` }))
                  : activePayees.map((p) => ({ value: p.id, label: `${p.name} (${t(`payeeType.${p.type}`)})` }))
              }
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('amount')}
            required
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input label={t('date')} required type="date" max={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {(type === 'EXPENSE' || type === 'DISBURSEMENT') && (
          <Select
            label={t('category')}
            required={type === 'EXPENSE'}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            placeholder={t('selectCategory')}
            options={activeCategories.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        {(type === 'EXPENSE' || type === 'DISBURSEMENT') && activeCategories.length === 0 && (
          <p className="-mt-2 text-xs text-red-600">
            {lookups.categoriesFailed ? t('categoriesLoadFailed') : t('noCategoriesYet')}{' '}
            <button type="button" onClick={lookups.reload} className="font-semibold text-teal underline">
              {t('retry')}
            </button>
          </p>
        )}

        <Input
          label={type === 'DISBURSEMENT' ? t('purpose') : t('description')}
          required
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {type === 'EXPENSE' && (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-800">
              {t('receipt')}
              {receiptRequired && (
                <span className="ml-0.5 text-red-500" aria-hidden="true">
                  *
                </span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={onFile} className="hidden" />
              <Button type="button" variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
                {receiptKey ? t('replaceReceipt') : t('uploadReceipt')}
              </Button>
              {receiptKey && <span className="text-sm text-gray-600">{receiptName}</span>}
            </div>
            {receiptLimit !== null && (
              <p className={`text-xs ${receiptRequired && !receiptKey ? 'text-red-600' : 'text-gray-500'}`}>
                {t('receiptRequiredHint', { limit: formatRupees(receiptLimit) })}
              </p>
            )}
          </div>
        )}

        {askNotes && direction && (
          <NotesFields direction={direction} value={notes} onChange={setNotes} amountPaise={amountPaise} inHand={inHand} />
        )}

        {needsApproval && threshold !== null && (
          <p className="rounded-xl bg-yellow-50 p-3 text-sm text-yellow-800">
            {t('requiresApprovalHint', { threshold: formatRupees(threshold) })}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" loading={saving} disabled={!valid || uploading}>
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
