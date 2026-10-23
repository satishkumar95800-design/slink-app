'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, BookCheck, BookOpen, BookUp, Coins, Library as LibraryIcon, Plus, Search } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { roleLabel } from '../../../lib/i18n/labels';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { Book, Borrower, COPY_STATUSES, CopyLookup, Loan, Page, Settings, Summary } from './types';

type Tab = 'desk' | 'catalogue' | 'loans' | 'settings';
const TABS: Tab[] = ['desk', 'catalogue', 'loans', 'settings'];

/** Library (flag `library`, Premium Max): librarian and admin. */
export default function LibraryPage() {
  const t = useTranslations('library');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (!features.library) return <EmptyState title={t('offTitle')} description={t('offBody')} />;
  return <LibraryDesk />;
}

function LibraryDesk() {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('desk');
  const [summary, setSummary] = useState<Summary | null>(null);

  const loadSummary = useCallback(() => {
    api
      .get<Summary>('/library/summary')
      .then(setSummary)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);
  useEffect(loadSummary, [loadSummary]);

  const tiles = summary
    ? [
        { icon: BookOpen, label: t('statTitles'), value: String(summary.titles), tone: 'bg-teal/10 text-teal' },
        { icon: BookCheck, label: t('statAvailable'), value: String(summary.available), tone: 'bg-green-100 text-green-800' },
        { icon: BookUp, label: t('statOnLoan'), value: String(summary.onLoan), tone: 'bg-purple-100 text-purple-800' },
        { icon: AlertTriangle, label: t('statOverdue'), value: String(summary.overdue), tone: 'bg-red-100 text-red-700' },
        { icon: Coins, label: t('statFines'), value: formatRupees(summary.finesDue), tone: 'bg-orange-100 text-orange-800' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary
          ? tiles.map((s) => (
              <div key={s.label} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))
          : [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 sm:w-fit">
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${tab === k ? 'bg-teal text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'desk' && <DeskTab onChanged={loadSummary} />}
      {tab === 'catalogue' && <CatalogueTab onChanged={loadSummary} />}
      {tab === 'loans' && <LoansTab onChanged={loadSummary} />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ── Desk: issue and return ────────────────────────────────────────────────────

function useLookup() {
  const errorText = useErrorText();
  const [copy, setCopy] = useState<CopyLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const find = useCallback(
    async (accessionNo: string) => {
      const a = accessionNo.trim();
      if (!a) return;
      setLoading(true);
      setError(null);
      try {
        setCopy(await api.get<CopyLookup>(`/library/copies/by-accession/${encodeURIComponent(a)}`));
      } catch (e) {
        setCopy(null);
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [errorText],
  );
  return { copy, error, loading, find, clear: () => setCopy(null) };
}

function DeskTab({ onChanged }: { onChanged: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <IssueCard onChanged={onChanged} />
      <ReturnCard onChanged={onChanged} />
    </div>
  );
}

function IssueCard({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('library');
  const tRoles = useTranslations('roles');
  const errorText = useErrorText();
  const { toast } = useToast();
  const lookup = useLookup();
  const [accession, setAccession] = useState('');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Borrower[]>([]);
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [dueOn, setDueOn] = useState('');
  const [busy, setBusy] = useState(false);
  const accessionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (borrower || query.trim().length < 2) {
      setFound([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get<Borrower[]>(`/library/borrowers?search=${encodeURIComponent(query.trim())}`)
        .then(setFound)
        .catch(() => setFound([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, borrower]);

  const copy = lookup.copy;
  const canIssue = !!copy && !copy.loan && copy.status === 'available' && !!borrower;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">{t('issueTitle')}</h2>
      <p className="text-xs text-gray-500">{t('issueHint')}</p>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup.find(accession);
        }}
      >
        <div className="flex-1">
          <Input ref={accessionRef} label={t('accessionNo')} value={accession} onChange={(e) => setAccession(e.target.value)} autoFocus placeholder={t('scanOrType')} />
        </div>
        <Button type="submit" variant="secondary" loading={lookup.loading}>
          <Search className="h-4 w-4" /> {t('find')}
        </Button>
      </form>
      {lookup.error && <p className="mt-2 text-sm text-red-600">{lookup.error}</p>}
      {copy && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
          <p className="font-semibold text-gray-900">{copy.book.title}</p>
          <p className="text-gray-600">{[copy.book.author, copy.book.shelf && t('shelfAt', { shelf: copy.book.shelf })].filter(Boolean).join(' · ')}</p>
          {copy.loan ? (
            <p className="mt-1 text-red-600">{t('alreadyOut', { name: copy.loan.borrower.name, date: formatDateOnly(copy.loan.dueOn) })}</p>
          ) : copy.status !== 'available' ? (
            <p className="mt-1 text-red-600">{t('notAvailable', { status: t(`copyStatus.${copy.status}`) })}</p>
          ) : (
            <p className="mt-1 text-green-700">{t('onShelf')}</p>
          )}
        </div>
      )}

      <div className="mt-4">
        {borrower ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-teal/30 bg-teal/5 p-3 text-sm">
            <span>
              <span className="font-semibold text-gray-900">{borrower.name}</span>
              <span className="block text-xs text-gray-500">
                {borrower.kind === 'staff' ? roleLabel(tRoles, borrower.detail) : borrower.detail} · {t('booksOut', { count: borrower.onLoan ?? 0 })}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setBorrower(null)}>
              {t('change')}
            </Button>
          </div>
        ) : (
          <>
            <Input label={t('borrower')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('borrowerPlaceholder')} />
            {found.length > 0 && (
              <ul className="mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-100">
                {found.map((b) => (
                  <li key={`${b.kind}-${b.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => {
                        setBorrower(b);
                        setQuery('');
                      }}
                    >
                      <span>
                        <span className="font-medium text-gray-900">{b.name}</span>
                        <span className="block text-xs text-gray-500">{b.kind === 'staff' ? roleLabel(tRoles, b.detail) : b.detail}</span>
                      </span>
                      <Badge variant={b.kind === 'staff' ? 'purple' : 'blue'}>{t(`borrowerKind.${b.kind}`)}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div className="w-44">
          <Input label={t('dueOnOptional')} type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        </div>
        <Button
          disabled={!canIssue}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const loan = await api.post<Loan>('/library/issue', {
                accessionNo: copy!.accessionNo,
                ...(borrower!.kind === 'student' ? { studentId: borrower!.id } : { userId: borrower!.id }),
                ...(dueOn ? { dueOn } : {}),
              });
              toast(t('issued', { title: loan.book.title, date: formatDateOnly(loan.dueOn) }), 'success');
              setAccession('');
              setBorrower(null);
              setDueOn('');
              lookup.clear();
              onChanged();
              accessionRef.current?.focus();
            } catch (e) {
              toast(errorText(e), 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('issue')}
        </Button>
      </div>
    </section>
  );
}

function ReturnCard({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const lookup = useLookup();
  const [accession, setAccession] = useState('');
  const [returned, setReturned] = useState<Loan | null>(null);
  const [busy, setBusy] = useState(false);
  const loan = lookup.copy?.loan ?? null;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">{t('returnTitle')}</h2>
      <p className="text-xs text-gray-500">{t('returnHint')}</p>
      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setReturned(null);
          void lookup.find(accession);
        }}
      >
        <div className="flex-1">
          <Input label={t('accessionNo')} value={accession} onChange={(e) => setAccession(e.target.value)} placeholder={t('scanOrType')} />
        </div>
        <Button type="submit" variant="secondary" loading={lookup.loading}>
          <Search className="h-4 w-4" /> {t('find')}
        </Button>
      </form>
      {lookup.error && <p className="mt-2 text-sm text-red-600">{lookup.error}</p>}
      {lookup.copy && !loan && !returned && <p className="mt-3 text-sm text-gray-600">{t('notOut', { title: lookup.copy.book.title })}</p>}
      {loan && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
          <p className="font-semibold text-gray-900">{loan.book.title}</p>
          <p className="text-gray-600">
            {loan.borrower.name} · {t('dueWas', { date: formatDateOnly(loan.dueOn) })}
          </p>
          {loan.daysLate > 0 && <p className="mt-1 font-semibold text-red-600">{t('daysLate', { count: loan.daysLate })}</p>}
          <div className="mt-3 flex justify-end">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api.post<Loan>('/library/return', { accessionNo: loan.accessionNo });
                  setReturned(r);
                  lookup.clear();
                  setAccession('');
                  toast(t('returned'), 'success');
                  onChanged();
                } catch (e) {
                  toast(errorText(e), 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('takeBack')}
            </Button>
          </div>
        </div>
      )}
      {returned && returned.fineStatus === 'due' && (
        <FineBox
          loan={returned}
          onDone={(l) => {
            setReturned(l);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function FineBox({ loan, onDone }: { loan: Loan; onDone: (l: Loan) => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (action: 'paid' | 'waived') => {
    setBusy(true);
    try {
      onDone(await api.post<Loan>(`/library/loans/${loan.id}/fine`, { action }));
      toast(action === 'paid' ? t('finePaid') : t('fineWaived'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-orange-50 p-3 text-sm">
      <span className="font-semibold text-orange-800">{t('fineDue', { amount: formatRupees(loan.fineAmount), days: loan.daysLate })}</span>
      <span className="flex gap-2">
        <Button size="sm" loading={busy} onClick={() => act('paid')}>
          {t('collected')}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => act('waived')}>
          {t('waive')}
        </Button>
      </span>
    </div>
  );
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

function CatalogueTab({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Book> | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Book | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (search.trim()) q.set('search', search.trim());
    api
      .get<Page<Book>>(`/library/books?${q}`)
      .then((d) => {
        setData(d);
        setOpen((o) => (o ? d.data.find((b) => b.id === o.id) ?? o : null));
      })
      .catch((e) => toast(errorText(e), 'error'));
  }, [page, search, errorText, toast]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm">
          <Input
            label={t('searchBooks')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {t('addBook')}
        </Button>
      </div>
      {!data ? (
        <Spinner className="mx-auto mt-8 h-6 w-6 text-teal" />
      ) : data.data.length === 0 ? (
        <EmptyState title={search ? t('noMatch') : t('emptyTitle')} description={search ? undefined : t('emptyBody')} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4">{t('bookTitle')}</th>
                <th className="py-2 pr-4">{t('category')}</th>
                <th className="py-2 pr-4">{t('shelf')}</th>
                <th className="py-2 pr-4 text-right">{t('availableOfTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((b) => (
                <tr key={b.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setOpen(b)}>
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold text-gray-900">{b.title}</span>
                    {b.author && <span className="block text-xs text-gray-500">{b.author}</span>}
                  </td>
                  <td className="py-2.5 pr-4">{b.category ?? '—'}</td>
                  <td className="py-2.5 pr-4">{b.shelf ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-right">
                    <Badge variant={b.available > 0 ? 'green' : 'gray'}>
                      {b.available} / {b.total}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span className="text-gray-500">{t('pageOf', { page, pages })}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t('next')}
              </Button>
            </div>
          )}
        </div>
      )}

      {adding && (
        <BookModal
          onClose={() => setAdding(false)}
          onSaved={(b) => {
            setAdding(false);
            load();
            onChanged();
            setOpen(b);
          }}
        />
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} subtitle={open?.author ?? ''} icon={<LibraryIcon className="h-5 w-5" />}>
        {open && (
          <BookDetail
            key={open.id}
            book={open}
            onChanged={(b) => {
              if (b) setOpen(b);
              else setOpen(null);
              load();
              onChanged();
            }}
          />
        )}
      </Drawer>
    </section>
  );
}

type BookFields = { title: string; author: string; isbn: string; publisher: string; category: string; language: string; shelf: string };
const bookFields = (b?: Book): BookFields => ({
  title: b?.title ?? '',
  author: b?.author ?? '',
  isbn: b?.isbn ?? '',
  publisher: b?.publisher ?? '',
  category: b?.category ?? '',
  language: b?.language ?? '',
  shelf: b?.shelf ?? '',
});

function BookFieldsForm({ value, onChange }: { value: BookFields; onChange: (v: BookFields) => void }) {
  const t = useTranslations('library');
  const field = (k: keyof BookFields, label: string, max: number, required = false) => (
    <Input label={label} required={required} maxLength={max} value={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.value })} />
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{field('title', t('bookTitle'), 200, true)}</div>
      {field('author', t('author'), 120)}
      {field('isbn', t('isbn'), 20)}
      {field('publisher', t('publisher'), 120)}
      {field('category', t('category'), 60)}
      {field('language', t('language'), 40)}
      {field('shelf', t('shelf'), 40)}
    </div>
  );
}

/** Accession numbers typed as "101, 102, 103" or "101-105". */
function parseAccessions(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range && Number(range[2]) >= Number(range[1]) && Number(range[2]) - Number(range[1]) < 200) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) out.push(String(n));
    } else out.push(part);
  }
  return out;
}

function CopiesInput({ mode, setMode, count, setCount, numbers, setNumbers }: {
  mode: 'auto' | 'manual';
  setMode: (m: 'auto' | 'manual') => void;
  count: string;
  setCount: (v: string) => void;
  numbers: string;
  setNumbers: (v: string) => void;
}) {
  const t = useTranslations('library');
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" className="accent-teal" checked={mode === 'auto'} onChange={() => setMode('auto')} /> {t('numberForMe')}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" className="accent-teal" checked={mode === 'manual'} onChange={() => setMode('manual')} /> {t('typeNumbers')}
        </label>
      </div>
      {mode === 'auto' ? (
        <div className="w-40">
          <Input label={t('howManyCopies')} type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
      ) : (
        <Input label={t('accessionNumbers')} value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder={t('accessionNumbersPlaceholder')} />
      )}
    </div>
  );
}

function copiesBody(mode: 'auto' | 'manual', count: string, numbers: string) {
  return mode === 'auto' ? { count: Number(count) || 0 } : { accessionNos: parseAccessions(numbers) };
}

function BookModal({ onClose, onSaved }: { onClose: () => void; onSaved: (b: Book) => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState<BookFields>(bookFields());
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [count, setCount] = useState('1');
  const [numbers, setNumbers] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('addBook')} size="xl">
      <BookFieldsForm value={f} onChange={setF} />
      <div className="mt-4">
        <CopiesInput mode={mode} setMode={setMode} count={count} setCount={setCount} numbers={numbers} setNumbers={setNumbers} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          loading={saving}
          disabled={!f.title.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              const b = await api.post<Book>('/library/books', { ...f, ...copiesBody(mode, count, numbers) });
              toast(t('bookAdded'), 'success');
              onSaved(b);
            } catch (e) {
              toast(errorText(e), 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('addBook')}
        </Button>
      </div>
    </Modal>
  );
}

function BookDetail({ book, onChanged }: { book: Book; onChanged: (b: Book | null) => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState<BookFields>(bookFields(book));
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [count, setCount] = useState('1');
  const [numbers, setNumbers] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<Book | null>, done: string) {
    setBusy(true);
    try {
      onChanged(await fn());
      toast(done, 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <h3 className="text-sm font-bold text-gray-900">{t('copies', { available: book.available, total: book.total })}</h3>
        <ul className="mt-3 divide-y divide-gray-100">
          {book.copies.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-mono font-semibold text-gray-900">#{c.accessionNo}</span>
                {c.loan && (
                  <span className={`block text-xs ${c.loan.daysLate > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {t('withBorrower', { name: c.loan.borrower.name, date: formatDateOnly(c.loan.dueOn) })}
                  </span>
                )}
              </span>
              {c.loan ? (
                <Badge variant="purple">{t('onLoan')}</Badge>
              ) : (
                <div className="w-36">
                  <Select
                    aria-label={t('copyStatusLabel', { no: c.accessionNo })}
                    value={c.status}
                    disabled={busy}
                    onChange={(e) =>
                      run(() => api.patch<Book>(`/library/copies/${c.id}`, { status: e.target.value }), t('copyUpdated'))
                    }
                    options={COPY_STATUSES.map((s) => ({ value: s, label: t(`copyStatus.${s}`) }))}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 border-t border-gray-100 pt-3">
          <CopiesInput mode={mode} setMode={setMode} count={count} setCount={setCount} numbers={numbers} setNumbers={setNumbers} />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => run(() => api.post<Book>(`/library/books/${book.id}/copies`, copiesBody(mode, count, numbers)), t('copiesAdded'))}
            >
              {t('addCopies')}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <BookFieldsForm value={f} onChange={setF} />
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t('deleteConfirm', { title: book.title })))
                void run(async () => {
                  await api.delete(`/library/books/${book.id}`);
                  return null;
                }, t('bookDeleted'));
            }}
          >
            {t('deleteBook')}
          </Button>
          <Button size="sm" disabled={!f.title.trim() || busy} onClick={() => run(() => api.patch<Book>(`/library/books/${book.id}`, f), t('bookSaved'))}>
            {t('save')}
          </Button>
        </div>
      </section>
    </div>
  );
}

// ── Loans ─────────────────────────────────────────────────────────────────────

type LoanFilter = 'open' | 'overdue' | 'returned' | 'fines';
const LOAN_FILTERS: LoanFilter[] = ['open', 'overdue', 'fines', 'returned'];

function LoansTab({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [filter, setFilter] = useState<LoanFilter>('overdue');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Loan> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Page<Loan>>(`/library/loans?status=${filter}&page=${page}`)
      .then(setData)
      .catch((e) => toast(errorText(e), 'error'));
  }, [filter, page, errorText, toast]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      toast(done, 'success');
      load();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {LOAN_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === f ? 'border-teal bg-teal text-white' : 'border-gray-200 text-gray-600 hover:border-teal'}`}
          >
            {t(`loanFilter.${f}`)}
          </button>
        ))}
      </div>
      {!data ? (
        <Spinner className="mx-auto mt-8 h-6 w-6 text-teal" />
      ) : data.data.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">{t('noLoans')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4">{t('bookTitle')}</th>
                <th className="py-2 pr-4">{t('borrower')}</th>
                <th className="py-2 pr-4">{t('issuedOn')}</th>
                <th className="py-2 pr-4">{filter === 'returned' ? t('returnedOn') : t('dueOn')}</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold text-gray-900">{l.book.title}</span>
                    <span className="block font-mono text-xs text-gray-500">#{l.accessionNo}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {l.borrower.name}
                    <span className="block text-xs text-gray-500">{l.borrower.kind === 'student' ? l.borrower.detail : t('borrowerKind.staff')}</span>
                  </td>
                  <td className="py-2.5 pr-4">{formatDateOnly(l.issuedOn)}</td>
                  <td className="py-2.5 pr-4">
                    {formatDateOnly(l.returnedOn ?? l.dueOn)}
                    {l.daysLate > 0 && <span className="block text-xs font-semibold text-red-600">{t('daysLate', { count: l.daysLate })}</span>}
                    {l.fineStatus !== 'none' && (
                      <span className="block text-xs text-gray-500">
                        {t(`fineStatus.${l.fineStatus}`, { amount: formatRupees(l.fineAmount) })}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {!l.returnedOn && (
                      <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => act(l.id, () => api.post(`/library/loans/${l.id}/renew`, {}), t('renewed'))}>
                        {t('renew')}
                      </Button>
                    )}
                    {l.fineStatus === 'due' && (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => act(l.id, () => api.post(`/library/loans/${l.id}/fine`, { action: 'paid' }), t('finePaid'))}>
                          {t('collected')}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => act(l.id, () => api.post(`/library/loans/${l.id}/fine`, { action: 'waived' }), t('fineWaived'))}>
                          {t('waive')}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span className="text-gray-500">{t('pageOf', { page, pages })}</span>
              <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t('next')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsTab() {
  const t = useTranslations('library');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [s, setS] = useState<Record<keyof Settings, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Settings>('/library/settings')
      .then((r) => setS({
        studentLoanDays: String(r.studentLoanDays),
        staffLoanDays: String(r.staffLoanDays),
        maxStudentBooks: String(r.maxStudentBooks),
        maxStaffBooks: String(r.maxStaffBooks),
        finePerDay: r.finePerDay,
      }))
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);

  if (!s) return <Spinner className="mx-auto mt-8 h-6 w-6 text-teal" />;
  const num = (k: keyof Settings, label: string, max: number) => (
    <Input label={label} type="number" min={1} max={max} value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
  );
  const valid = /^\d{1,6}(\.\d{1,2})?$/.test(s.finePerDay) && ['studentLoanDays', 'staffLoanDays', 'maxStudentBooks', 'maxStaffBooks'].every((k) => Number(s[k as keyof Settings]) >= 1);

  return (
    <section className="max-w-2xl rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {num('studentLoanDays', t('studentLoanDays'), 365)}
        {num('staffLoanDays', t('staffLoanDays'), 365)}
        {num('maxStudentBooks', t('maxStudentBooks'), 20)}
        {num('maxStaffBooks', t('maxStaffBooks'), 50)}
        <Input label={t('finePerDay')} inputMode="decimal" value={s.finePerDay} onChange={(e) => setS({ ...s, finePerDay: e.target.value.trim() })} />
      </div>
      <p className="mt-2 text-xs text-gray-500">{t('finePerDayHint')}</p>
      <div className="mt-4 flex justify-end">
        <Button
          loading={saving}
          disabled={!valid}
          onClick={async () => {
            setSaving(true);
            try {
              await api.put('/library/settings', {
                studentLoanDays: Number(s.studentLoanDays),
                staffLoanDays: Number(s.staffLoanDays),
                maxStudentBooks: Number(s.maxStudentBooks),
                maxStaffBooks: Number(s.maxStaffBooks),
                finePerDay: s.finePerDay,
              });
              toast(t('settingsSaved'), 'success');
            } catch (e) {
              toast(errorText(e), 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('save')}
        </Button>
      </div>
    </section>
  );
}
