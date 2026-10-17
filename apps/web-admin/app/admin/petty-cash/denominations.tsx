'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateTime, formatRupees } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import { CashInHand, CashNotes, DENOMINATIONS, NoteCounts, countsPaise } from './types';

/** One number box per note and coin, with a running total. */
export function NoteGrid({
  counts,
  onChange,
  inHand,
}: {
  counts: NoteCounts;
  onChange: (c: NoteCounts) => void;
  /** Shown under each box when handing notes out, red when asking for more than the box has. */
  inHand?: NoteCounts | null;
}) {
  const t = useTranslations('pettyCash');
  function set(d: number, raw: string) {
    const n = Math.max(0, Math.floor(Number(raw) || 0));
    const next = { ...counts };
    if (n) next[String(d)] = n;
    else delete next[String(d)];
    onChange(next);
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {DENOMINATIONS.map((d) => {
          const count = counts[String(d)] ?? 0;
          const have = inHand ? (inHand[String(d)] ?? 0) : null;
          return (
            <label key={d} className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2">
              <span className="text-xs font-semibold text-gray-700">{formatRupees(d)}</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={count || ''}
                placeholder="0"
                onChange={(e) => set(d, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
              />
              {have !== null && (
                <span className={`text-[11px] ${count > have ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                  {t('notesInHand', { count: have })}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-right text-sm text-gray-700">
        {t('notesTotal')}: <span className="font-semibold">{formatRupees(countsPaise(counts) / 100)}</span>
      </p>
    </div>
  );
}

/** Cash into the box minus cash out of it, in paise. */
export function notesNetPaise(n: CashNotes): number {
  return countsPaise(n.in) - countsPaise(n.out);
}

/**
 * The notes for one cash entry. `direction` is where the money goes: 'out' for
 * cash given or paid (with optional change received back), 'in' for cash
 * received (with optional change given back).
 */
export function NotesFields({
  direction,
  value,
  onChange,
  amountPaise,
  inHand,
}: {
  direction: 'in' | 'out';
  value: CashNotes;
  onChange: (n: CashNotes) => void;
  amountPaise: number;
  inHand: NoteCounts | null;
}) {
  const t = useTranslations('pettyCash');
  const main = direction;
  const change = direction === 'out' ? 'in' : 'out';
  const [showChange, setShowChange] = useState(Object.keys(value[change]).length > 0);
  const moved = direction === 'out' ? -notesNetPaise(value) : notesNetPaise(value);
  const entered = Object.keys(value.in).length + Object.keys(value.out).length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white/60 p-3">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-800">
          {direction === 'out' ? t('notesGiven') : t('notesReceived')}
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        </p>
        <NoteGrid
          counts={value[main]}
          onChange={(c) => onChange({ ...value, [main]: c })}
          inHand={direction === 'out' ? inHand : null}
        />
      </div>
      {showChange ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{direction === 'out' ? t('changeReceived') : t('changeGiven')}</p>
            <button
              type="button"
              className="cursor-pointer text-xs font-semibold text-teal underline"
              onClick={() => {
                setShowChange(false);
                onChange({ ...value, [change]: {} });
              }}
            >
              {t('removeChange')}
            </button>
          </div>
          <NoteGrid
            counts={value[change]}
            onChange={(c) => onChange({ ...value, [change]: c })}
            inHand={direction === 'in' ? inHand : null}
          />
        </div>
      ) : (
        <button type="button" className="cursor-pointer text-sm font-semibold text-teal underline" onClick={() => setShowChange(true)}>
          {direction === 'out' ? t('addChangeReceived') : t('addChangeGiven')}
        </button>
      )}
      {amountPaise > 0 && entered && (
        <p className={`rounded-xl p-2 text-sm ${moved === amountPaise ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
          {moved === amountPaise
            ? t('notesAddUp', { amount: formatRupees(amountPaise / 100) })
            : t('notesMismatch', { notes: formatRupees(moved / 100), amount: formatRupees(amountPaise / 100) })}
        </p>
      )}
    </div>
  );
}

/** "₹500 × 2, ₹10 × 1" */
export function useNotesText() {
  const t = useTranslations('pettyCash');
  return (c: NoteCounts) =>
    DENOMINATIONS.filter((d) => c[String(d)])
      .map((d) => t('noteTimes', { note: formatRupees(d), count: c[String(d)] }))
      .join(', ');
}

/** Overview card: notes in hand, how they compare with the ledger, and the cash count. */
export function CashInHandCard({ version }: { version: number }) {
  const t = useTranslations('pettyCash');
  const [data, setData] = useState<CashInHand | null>(null);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    api.get<CashInHand>('/petty-cash/cash-in-hand').then(setData).catch(() => setData(null));
  }, [version]);

  if (!data || !data.tracking) return null;

  const diff = Number(data.difference);
  const negative = data.notes.some((n) => n.count < 0);
  const rows = data.notes.filter((n) => n.count !== 0);

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('cashInHandTitle')}</h2>
          <p className="text-sm text-gray-500">{t('cashInHandHelp')}</p>
        </div>
        <Button size="sm" onClick={() => setCounting(true)}>
          {t('countCash')}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-cream/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('notesInHandLabel')}</p>
          <p className="mt-1 text-xl font-extrabold text-gray-900">{formatRupees(data.total)}</p>
        </div>
        <div className="rounded-xl bg-cream/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('ledgerBalanceLabel')}</p>
          <p className="mt-1 text-xl font-extrabold text-gray-900">{formatRupees(data.ledgerBalance)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {!data.lastCount ? (
          <p className="rounded-xl bg-yellow-50 p-3 text-yellow-900">{t('neverCounted')}</p>
        ) : diff === 0 ? (
          <p className="rounded-xl bg-green-50 p-3 text-green-800">{t('notesMatch')}</p>
        ) : (
          <p className="rounded-xl bg-red-50 p-3 text-red-700">
            {diff < 0 ? t('notesShort', { amount: formatRupees(-diff) }) : t('notesExcess', { amount: formatRupees(diff) })}
          </p>
        )}
        {negative && <p className="rounded-xl bg-red-50 p-3 text-red-700">{t('notesNegative')}</p>}
        {data.untrackedEntries > 0 && (
          <p className="rounded-xl bg-yellow-50 p-3 text-yellow-900">{t('untrackedEntries', { count: data.untrackedEntries })}</p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                {[t('colNote'), t('colCount'), t('colValue')].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((n) => (
                <tr key={n.value} className={n.count < 0 ? 'text-red-600' : ''}>
                  <td className="px-3 py-1.5 text-sm font-medium">{formatRupees(n.value)}</td>
                  <td className="px-3 py-1.5 text-sm">{n.count}</td>
                  <td className="px-3 py-1.5 text-sm">{formatRupees(n.value * n.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.lastCount && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            {t('lastCounted', { date: formatDateTime(data.lastCount.countedAt), name: data.lastCount.countedBy.name })}
          </p>
          {data.recentCounts.length > 1 && (
            <>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('recentCounts')}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {data.recentCounts.map((c) => (
                  <li key={c.id}>
                    {t('countLine', { date: formatDateTime(c.countedAt), name: c.countedBy.name, total: formatRupees(c.total) })}
                    {Number(c.difference) !== 0 && (
                      <span className="text-red-600">
                        {' · '}
                        {Number(c.difference) < 0
                          ? t('countShort', { amount: formatRupees(-Number(c.difference)) })
                          : t('countExtra', { amount: formatRupees(c.difference) })}
                      </span>
                    )}
                    {c.note && <span> · {c.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {counting && (
        <CountModal
          current={data}
          onClose={() => setCounting(false)}
          onSaved={(next) => {
            setData(next);
            setCounting(false);
          }}
        />
      )}
    </section>
  );
}

function CountModal({
  current,
  onClose,
  onSaved,
}: {
  current: CashInHand;
  onClose: () => void;
  onSaved: (next: CashInHand) => void;
}) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  // Start from what the records say is in the box; the counter corrects it.
  const [counts, setCounts] = useState<NoteCounts>(() =>
    Object.fromEntries(current.notes.filter((n) => n.count > 0).map((n) => [String(n.value), n.count])),
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const next = await api.post<CashInHand>('/petty-cash/cash-counts', {
        counts,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(t('countSaved'), 'success');
      onSaved(next);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const total = countsPaise(counts) / 100;
  return (
    <Modal open onClose={onClose} title={t('countTitle')} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('countHelp')}</p>
        <NoteGrid counts={counts} onChange={setCounts} />
        <p
          className={`rounded-xl p-3 text-sm ${
            total === Number(current.ledgerBalance) ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {t('countVsLedger', { total: formatRupees(total), balance: formatRupees(current.ledgerBalance) })}
        </p>
        <Input label={t('countNote')} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} onClick={save}>
            {tCommon('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
