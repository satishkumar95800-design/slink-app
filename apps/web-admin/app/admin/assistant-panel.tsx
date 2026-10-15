'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { api } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../lib/format';
import { paymentMethodLabel } from '../../lib/i18n/labels';

type ColumnType = 'text' | 'number' | 'percent' | 'money' | 'date';

export interface AssistantAnswer {
  tool: string;
  headline: { key: string; params: Record<string, string | number> };
  columns: { key: string; type: ColumnType }[];
  rows: (string | number | null)[][];
  truncated?: boolean;
}

const HEADLINES = [
  'attendance_overall',
  'low_attendance_count',
  'absentees_count',
  'outstanding_total',
  'collected_total',
  'students_total',
  'teachers_with_periods',
  'cant_answer',
] as const;
const COLUMNS = [
  'class',
  'attendance',
  'records',
  'student',
  'status',
  'outstanding',
  'oldestDue',
  'method',
  'amount',
  'receipts',
  'students',
  'teacher',
  'periods',
] as const;
const STATUSES = ['present', 'absent', 'late', 'leave'] as const;
const isOneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/** "Ask about your school…" box for the dashboard header (premium). */
export function AskBox({ onAsk }: { onAsk: (question: string) => void }) {
  const t = useTranslations('assistant');
  const [q, setQ] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) onAsk(q.trim());
  }
  return (
    <form onSubmit={submit} className="relative w-full max-w-xl">
      <Sparkles className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        maxLength={300}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="w-full rounded-full border border-white/20 bg-white/10 py-3 pl-11 pr-12 text-sm text-white placeholder-white/60 outline-none backdrop-blur transition focus:border-white/50 focus:bg-white/15"
      />
      <button
        type="submit"
        aria-label={t('ask')}
        title={t('ask')}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-coral text-white transition-colors hover:bg-coral-dark"
      >
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

/** The conversation in the side panel: each question with its data-backed answer. */
export function AssistantThread({
  first,
  examples,
}: {
  first: string | null;
  examples: string[];
}) {
  const t = useTranslations('assistant');
  const errorText = useErrorText();
  const [items, setItems] = useState<{ q: string; a?: AssistantAnswer; error?: string }[]>(
    first ? [{ q: first }] : [],
  );
  const askedFirst = useRef(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    setBusy(true);
    setItems((prev) => (prev.at(-1)?.q === question && !prev.at(-1)?.a ? prev : [...prev, { q: question }]));
    try {
      const a = await api.post<AssistantAnswer>('/assistant/ask', { question });
      setItems((prev) => prev.map((it, i) => (i === prev.length - 1 ? { ...it, a } : it)));
    } catch (e) {
      const error = errorText(e);
      setItems((prev) => prev.map((it, i) => (i === prev.length - 1 ? { ...it, error } : it)));
    } finally {
      setBusy(false);
    }
  }

  // Answer the question typed in the header once, when the panel opens.
  useEffect(() => {
    if (!first || askedFirst.current) return;
    askedFirst.current = true;
    void ask(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2 || busy) return;
    void ask(q.trim());
    setQ('');
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {items.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{t('intro')}</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void ask(ex)}
                className="cursor-pointer rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-4">
        {items.map((it, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-teal px-4 py-2 text-sm text-white">{it.q}</p>
            {it.a ? (
              <Answer a={it.a} />
            ) : it.error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{it.error}</p>
            ) : (
              <p className="w-fit animate-pulse rounded-2xl bg-white px-4 py-3 text-sm text-gray-400 shadow-sm">{t('thinking')}</p>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="sticky bottom-0 mt-auto flex gap-2 bg-cream pt-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="min-w-0 flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-coral px-5 text-sm font-bold text-white hover:bg-coral-dark disabled:opacity-60"
        >
          {t('ask')}
        </button>
      </form>
      <p className="text-[11px] text-gray-400">{t('footnote')}</p>
    </div>
  );
}

function Answer({ a }: { a: AssistantAnswer }) {
  const t = useTranslations('assistant');
  const tMethod = useTranslations('paymentMethod');
  const tStatus = useTranslations('attendanceStatus');
  const locale = useLocale();

  const params: Record<string, string | number> = { ...a.headline.params };
  if ('amount' in params) params.amount = formatRupees(Number(params.amount));
  for (const k of ['from', 'to', 'date'] as const) {
    if (typeof params[k] === 'string') params[k] = formatDateOnly(String(params[k]));
  }
  const headline = isOneOf(HEADLINES, a.headline.key) ? t(`h_${a.headline.key}`, params) : t('h_cant_answer');

  const cell = (v: string | number | null, type: ColumnType, colKey: string) => {
    if (v === null || v === '') return '—';
    if (colKey === 'method') return paymentMethodLabel(tMethod, String(v));
    if (colKey === 'status' && isOneOf(STATUSES, String(v))) return tStatus(String(v) as (typeof STATUSES)[number]);
    switch (type) {
      case 'money':
        return formatRupees(Number(v));
      case 'percent':
        return `${v}%`;
      case 'date':
        return formatDateOnly(String(v));
      case 'number':
        return Number(v).toLocaleString(`${locale}-IN-u-nu-latn`);
      default:
        return String(v);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl rounded-bl-md border border-black/5 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{headline}</p>
      {a.headline.key === 'cant_answer' && <p className="text-xs text-gray-500">{t('cantAnswerHelp')}</p>}
      {a.columns.length > 0 && a.rows.length > 0 && (
        <div className="max-h-80 overflow-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-cream">
              <tr>
                {a.columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-3 py-2 text-xs font-semibold text-teal/80 ${
                      c.type === 'text' || c.type === 'date' ? 'text-left' : 'text-right'
                    }`}
                  >
                    {isOneOf(COLUMNS, c.key) ? t(`c_${c.key}`) : c.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {a.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <td
                      key={j}
                      className={`px-3 py-1.5 text-gray-700 ${
                        a.columns[j]?.type === 'text' || a.columns[j]?.type === 'date' ? 'text-left' : 'text-right font-medium'
                      }`}
                    >
                      {cell(v, a.columns[j]?.type ?? 'text', a.columns[j]?.key ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {a.truncated && <p className="text-xs text-gray-500">{t('truncated')}</p>}
    </div>
  );
}
