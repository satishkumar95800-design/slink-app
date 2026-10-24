'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ChevronRight, DoorOpen, LogOut, PhoneCall, PhoneIncoming, PhoneOutgoing, Plus, UserPlus, Users } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { formatDateOnly, formatDateTime, formatRupees } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
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
import { AddEnquiry } from '../admissions/add-enquiry';
import { EnquiryDrawerBody } from '../admissions/enquiry-drawer';
import { STAGES, STAGE_VARIANT } from '../admissions/types';
import { AppointmentsTab } from './appointments-tab';
import { FormsTab } from './forms-tab';
import { Call, DeskPayment, EnquiryRef, Today, VISITOR_PURPOSES, Visitor, todayYmd } from './types';

type Tab = 'today' | 'appointments' | 'visitors' | 'calls' | 'receipts' | 'forms';
const TABS: Tab[] = ['today', 'appointments', 'visitors', 'calls', 'receipts', 'forms'];

/**
 * The receptionist's front desk: today's follow-ups to tick off, who is in the
 * building, the visitor book, the call log and the desk receipts. Enquiries
 * open in the same panel as on the Admissions page.
 */
export default function ReceptionPage() {
  const t = useTranslations('reception');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (!features.admissions) return <EmptyState title={t('offTitle')} description={t('offBody')} />;
  return <FrontDesk />;
}

function FrontDesk() {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState<Today | null>(null);
  const [open, setOpen] = useState<Pick<EnquiryRef, 'id' | 'childName' | 'parentName' | 'phone'> | null>(null);
  const [adding, setAdding] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [logging, setLogging] = useState(false);
  const [newList, setNewList] = useState(false);
  /** Today-tab section a card pointed at, briefly outlined. */
  const [highlight, setHighlight] = useState<'followUps' | 'inside' | null>(null);

  const load = useCallback(() => {
    api
      .get<Today>('/reception/today')
      .then(setToday)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);

  useEffect(load, [load]);

  /** Today tab, scrolled to the section, outlined for a moment. */
  const showSection = (section: 'followUps' | 'inside') => {
    setTab('today');
    setHighlight(section);
    window.setTimeout(() => document.getElementById(`desk-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    window.setTimeout(() => setHighlight(null), 1600);
  };

  const stats = today
    ? [
        { icon: CalendarClock, label: t('statFollowUps'), value: today.followUps.length, tone: 'bg-coral/10 text-coral-dark', onClick: () => showSection('followUps') },
        { icon: DoorOpen, label: t('statInside'), value: today.visitorsInside.length, tone: 'bg-teal/10 text-teal', onClick: () => showSection('inside') },
        { icon: PhoneCall, label: t('statCalls'), value: today.counts.callsToday, tone: 'bg-purple-100 text-purple-800', onClick: () => setTab('calls') },
        { icon: UserPlus, label: t('statNewEnquiries'), value: today.counts.newEnquiriesToday, tone: 'bg-green-100 text-green-800', onClick: () => setNewList(true) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{today ? formatDateOnly(today.date) : ' '}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> {t('newEnquiry')}
          </Button>
          <Button variant="secondary" onClick={() => setSigningIn(true)}>
            <Users className="h-4 w-4" /> {t('signInVisitor')}
          </Button>
          <Button variant="secondary" onClick={() => setLogging(true)}>
            <PhoneCall className="h-4 w-4" /> {t('logCall')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {today
          ? stats.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={s.onClick}
                className="group cursor-pointer rounded-2xl border border-black/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
              >
                <span className="flex items-start justify-between">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}>
                    <s.icon className="h-5 w-5" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500" />
                </span>
                <span className="mt-3 block text-2xl font-extrabold text-gray-900">{s.value}</span>
                <span className="block text-xs text-gray-500">{s.label}</span>
              </button>
            ))
          : [0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
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

      {tab === 'today' && (
        <TodayTab
          today={today}
          highlight={highlight}
          onOpen={(e) => setOpen(e)}
          onChanged={load}
        />
      )}
      {tab === 'visitors' && <VisitorsTab onChanged={load} />}
      {tab === 'calls' && <CallsTab onOpen={(e) => setOpen(e)} />}
      {tab === 'receipts' && <ReceiptsTab />}
      {tab === 'appointments' && <AppointmentsTab />}
      {tab === 'forms' && <FormsTab />}

      <Drawer
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.childName ?? ''}
        subtitle={open ? `${open.parentName} · ${open.phone}` : ''}
        icon={<UserPlus className="h-5 w-5" />}
      >
        {open && <EnquiryDrawerBody key={open.id} id={open.id} onChanged={load} />}
      </Drawer>

      <Drawer open={newList} onClose={() => setNewList(false)} title={t('newTodayTitle')} subtitle={today ? formatDateOnly(today.date) : ''} icon={<UserPlus className="h-5 w-5" />}>
        {newList && (
          <NewToday
            onOpen={(e) => {
              setNewList(false);
              setOpen(e);
            }}
          />
        )}
      </Drawer>

      {adding && (
        <AddEnquiry
          onClose={() => setAdding(false)}
          onDone={(id) => {
            setAdding(false);
            load();
            api.get<EnquiryRef>(`/admissions/${id}`).then(setOpen).catch(() => undefined);
          }}
        />
      )}
      {signingIn && (
        <VisitorModal
          onClose={() => setSigningIn(false)}
          onDone={() => {
            setSigningIn(false);
            load();
          }}
        />
      )}
      {logging && (
        <CallModal
          onClose={() => setLogging(false)}
          onDone={() => {
            setLogging(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Enquiries made today, each opening its own drawer. */
function NewToday({ onOpen }: { onOpen: (e: EnquiryRef) => void }) {
  const t = useTranslations('reception');
  const tAdm = useTranslations('admissions');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<EnquiryRef[] | null>(null);

  useEffect(() => {
    api
      .get<{ data: EnquiryRef[] }>('/admissions?created=today&limit=100')
      .then((r) => setRows(r.data))
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);

  if (!rows)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500">{t('newTodayNone')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-black/5 bg-white">
          {rows.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/60">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{e.childName}</span>
                    <Badge variant={STAGE_VARIANT[e.stage]}>{tAdm(`stages.${e.stage}`)}</Badge>
                  </span>
                  <span className="block text-sm text-gray-600">
                    {[e.parentName, e.phone, e.classSought].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <a href="/admin/admissions" className="inline-block text-sm font-semibold text-teal hover:underline">
        {t('openAdmissions')}
      </a>
    </div>
  );
}

function TodayTab({
  today,
  highlight,
  onOpen,
  onChanged,
}: {
  today: Today | null;
  highlight: 'followUps' | 'inside' | null;
  onOpen: (e: EnquiryRef) => void;
  onChanged: () => void;
}) {
  const t = useTranslations('reception');
  const tAdm = useTranslations('admissions');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (!today)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      toast(done, 'success');
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section id="desk-followUps" className={`scroll-mt-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-shadow ${highlight === 'followUps' ? 'ring-2 ring-coral' : ''}`}>
        <h2 className="text-base font-bold text-gray-900">{t('followUpsDue')}</h2>
        <p className="text-xs text-gray-500">{t('followUpsDueHint')}</p>
        {today.followUps.length === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-500">{t('allCaughtUp')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {today.followUps.map((f) => (
              <li key={f.id} className="flex items-start gap-3 py-3">
                <input
                  type="checkbox"
                  aria-label={t('markDone')}
                  className="mt-1 h-5 w-5 accent-teal"
                  disabled={busy === f.id}
                  onChange={() => act(f.id, () => api.post(`/reception/follow-ups/${f.id}/done`, {}), t('followUpDone'))}
                />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(f.enquiry)}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 hover:underline">{f.enquiry.childName}</span>
                    <Badge variant={STAGE_VARIANT[f.enquiry.stage]}>{tAdm(`stages.${f.enquiry.stage}`)}</Badge>
                    {f.overdue && <Badge variant="red">{t('overdueSince', { date: formatDateOnly(f.dueOn) })}</Badge>}
                  </span>
                  <span className="block text-sm text-gray-600">
                    {t(`kinds.${f.kind}`)} · {f.enquiry.parentName} · {f.enquiry.phone}
                  </span>
                  {f.note && <span className="block text-sm text-gray-500">{f.note}</span>}
                </button>
                <a href={`tel:${f.enquiry.phone}`} className="rounded-full p-2 text-teal hover:bg-teal/10" aria-label={t('callNow')}>
                  <PhoneOutgoing className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="space-y-6">
        <section id="desk-inside" className={`scroll-mt-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm transition-shadow ${highlight === 'inside' ? 'ring-2 ring-teal' : ''}`}>
          <h2 className="text-base font-bold text-gray-900">{t('inBuilding')}</h2>
          {today.visitorsInside.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">{t('nobodyInside')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {today.visitorsInside.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold text-gray-900">{v.name}</span>
                    {v.people > 1 && <span className="text-gray-500"> +{v.people - 1}</span>}
                    <span className="block text-xs text-gray-500">
                      {t(`visitorPurposes.${v.purpose}`)}
                      {v.whomToMeet ? ` · ${v.whomToMeet}` : ''} · {t('inAt', { time: formatDateTime(v.inAt) })}
                    </span>
                  </span>
                  <Button size="sm" variant="ghost" disabled={busy === v.id} onClick={() => act(v.id, () => api.post(`/reception/visitors/${v.id}/out`, {}), t('signedOut'))}>
                    <LogOut className="h-4 w-4" /> {t('signOut')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-900">{t('pipeline')}</h2>
          <ul className="mt-3 space-y-2">
            {STAGES.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Badge variant={STAGE_VARIANT[s]}>{tAdm(`stages.${s}`)}</Badge>
                <span className="font-bold text-gray-900">{today.counts.byStage[s] ?? 0}</span>
              </li>
            ))}
          </ul>
          {today.counts.registrationsWithoutFee > 0 && (
            <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-800">
              {t('registrationsWithoutFee', { count: today.counts.registrationsWithoutFee })}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('reception');
  return (
    <div className="w-44">
      <Input label={t('day')} type="date" max={todayYmd()} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

function VisitorsTab({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [date, setDate] = useState(todayYmd());
  const [rows, setRows] = useState<Visitor[] | null>(null);

  const load = useCallback(() => {
    api
      .get<Visitor[]>(`/reception/visitors?date=${date}`)
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
  }, [date, errorText, toast]);
  useEffect(load, [load]);

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <DayPicker value={date} onChange={setDate} />
      {!rows ? (
        <Spinner className="mx-auto mt-6 h-6 w-6 text-teal" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">{t('noVisitors')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4">{t('visitorName')}</th>
                <th className="py-2 pr-4">{t('purpose')}</th>
                <th className="py-2 pr-4">{t('whomToMeet')}</th>
                <th className="py-2 pr-4">{t('timeIn')}</th>
                <th className="py-2 pr-4">{t('timeOut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="py-2.5 pr-4">
                    <span className="font-semibold text-gray-900">{v.name}</span>
                    {v.phone && <span className="block text-xs text-gray-500">{v.phone}</span>}
                  </td>
                  <td className="py-2.5 pr-4">{t(`visitorPurposes.${v.purpose}`)}</td>
                  <td className="py-2.5 pr-4">{v.whomToMeet ?? '—'}</td>
                  <td className="py-2.5 pr-4">{formatDateTime(v.inAt)}</td>
                  <td className="py-2.5 pr-4">
                    {v.outAt ? (
                      formatDateTime(v.outAt)
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api.post(`/reception/visitors/${v.id}/out`, {});
                            toast(t('signedOut'), 'success');
                            load();
                            onChanged();
                          } catch (e) {
                            toast(errorText(e), 'error');
                          }
                        }}
                      >
                        {t('signOut')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CallsTab({ onOpen }: { onOpen: (e: EnquiryRef) => void }) {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [date, setDate] = useState(todayYmd());
  const [rows, setRows] = useState<Call[] | null>(null);

  useEffect(() => {
    api
      .get<Call[]>(`/reception/calls?date=${date}`)
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
  }, [date, errorText, toast]);

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <DayPicker value={date} onChange={setDate} />
      {!rows ? (
        <Spinner className="mx-auto mt-6 h-6 w-6 text-teal" />
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">{t('noCalls')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {rows.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-3 text-sm">
              {c.direction === 'incoming' ? (
                <PhoneIncoming className="mt-0.5 h-4 w-4 text-teal" aria-label={t('directions.incoming')} />
              ) : (
                <PhoneOutgoing className="mt-0.5 h-4 w-4 text-purple-700" aria-label={t('directions.outgoing')} />
              )}
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-gray-900">{c.name || c.phone}</span>
                {c.name && <span className="text-gray-500"> · {c.phone}</span>}
                {(c.purpose || c.note) && <span className="block text-gray-600">{[c.purpose, c.note].filter(Boolean).join(' — ')}</span>}
                <span className="block text-xs text-gray-500">{formatDateTime(c.at)}</span>
              </span>
              {c.enquiry && (
                <button
                  type="button"
                  className="text-xs font-bold text-teal hover:underline"
                  onClick={() => onOpen({ id: c.enquiry!.id, childName: c.enquiry!.childName, parentName: c.name ?? '', phone: c.phone, stage: 'enquiry', classSought: null })}
                >
                  {c.enquiry.childName}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReceiptsTab() {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [from, setFrom] = useState(todayYmd());
  const [to, setTo] = useState(todayYmd());
  const [data, setData] = useState<{
    data: (DeskPayment & { enquiry: { childName: string; parentName: string } })[];
    totals: { all: string; byMode: Record<string, string> };
  } | null>(null);

  useEffect(() => {
    if (from > to) return;
    api
      .get<typeof data>(`/reception/payments?from=${from}&to=${to}`)
      .then(setData)
      .catch((e) => toast(errorText(e), 'error'));
  }, [from, to, errorText, toast]);

  return (
    <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Input label={t('from')} type="date" max={todayYmd()} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </div>
        <div className="w-44">
          <Input label={t('to')} type="date" max={todayYmd()} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </div>
        {data && (
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">{t('totalCollected')}</p>
            <p className="text-xl font-extrabold text-gray-900">{formatRupees(data.totals.all)}</p>
            <p className="text-xs text-gray-500">
              {Object.entries(data.totals.byMode)
                .map(([m, v]) => `${t(`modes.${m as 'cash'}`)} ${formatRupees(v)}`)
                .join(' · ')}
            </p>
          </div>
        )}
      </div>
      {!data ? (
        <Spinner className="mx-auto mt-6 h-6 w-6 text-teal" />
      ) : data.data.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">{t('noPayments')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-4">{t('receipt')}</th>
                <th className="py-2 pr-4">{t('child')}</th>
                <th className="py-2 pr-4">{t('purpose')}</th>
                <th className="py-2 pr-4">{t('mode')}</th>
                <th className="py-2 pr-4 text-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.data.map((p) => (
                <tr key={p.id} className={p.void ? 'text-gray-400 line-through' : ''}>
                  <td className="py-2.5 pr-4">
                    <a href={`/admin/reception/receipt/${p.id}`} target="_blank" rel="noreferrer" className="font-semibold text-teal hover:underline">
                      #{p.receiptNo}
                    </a>
                    <span className="block text-xs text-gray-500">{formatDateOnly(p.receivedOn)}</span>
                  </td>
                  <td className="py-2.5 pr-4">{p.enquiry.childName}</td>
                  <td className="py-2.5 pr-4">{t(`purposes.${p.purpose}`)}</td>
                  <td className="py-2.5 pr-4">{t(`modes.${p.mode}`)}</td>
                  <td className="py-2.5 pr-4 text-right font-semibold">{formatRupees(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VisitorModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', phone: '', purpose: 'parent_meeting', whomToMeet: '', people: '1', note: '' });
  const [saving, setSaving] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('signInVisitor')} size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('visitorName')} required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label={t('phone')} inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Select label={t('purpose')} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} options={VISITOR_PURPOSES.map((p) => ({ value: p, label: t(`visitorPurposes.${p}`) }))} />
        <Input label={t('whomToMeet')} maxLength={100} value={f.whomToMeet} onChange={(e) => setF({ ...f, whomToMeet: e.target.value })} />
        <Input label={t('people')} type="number" min={1} max={50} value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} />
        <Input label={t('note')} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          loading={saving}
          disabled={!f.name.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await api.post('/reception/visitors', {
                name: f.name.trim(),
                phone: f.phone.trim() || undefined,
                purpose: f.purpose,
                whomToMeet: f.whomToMeet.trim() || undefined,
                people: Number(f.people) || 1,
                note: f.note.trim() || undefined,
              });
              toast(t('signedIn'), 'success');
              onDone();
            } catch (e) {
              toast(errorText(e), 'error');
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('signIn')}
        </Button>
      </div>
    </Modal>
  );
}

function CallModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState({ direction: 'incoming', name: '', phone: '', purpose: '', note: '' });
  const [matches, setMatches] = useState<EnquiryRef[]>([]);
  const [enquiryId, setEnquiryId] = useState('');
  const [saving, setSaving] = useState(false);

  // Link the call to an enquiry with the same phone number, if there is one.
  useEffect(() => {
    const digits = f.phone.replace(/\D/g, '');
    if (digits.length < 6) {
      setMatches([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .get<{ data: EnquiryRef[] }>(`/admissions?q=${encodeURIComponent(digits.slice(-10))}`)
        .then((r) => setMatches(r.data.slice(0, 5)))
        .catch(() => setMatches([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [f.phone]);

  return (
    <Modal open onClose={onClose} title={t('logCall')} size="lg">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label={t('direction')}
          value={f.direction}
          onChange={(e) => setF({ ...f, direction: e.target.value })}
          options={(['incoming', 'outgoing'] as const).map((d) => ({ value: d, label: t(`directions.${d}`) }))}
        />
        <Input label={t('phone')} required inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input label={t('callerName')} maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label={t('purpose')} maxLength={100} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder={t('callPurposePlaceholder')} />
        <div className="sm:col-span-2">
          <Input label={t('note')} maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </div>
        {matches.length > 0 && (
          <div className="sm:col-span-2">
            <Select
              label={t('linkEnquiry')}
              value={enquiryId}
              onChange={(e) => setEnquiryId(e.target.value)}
              options={[{ value: '', label: t('noLink') }, ...matches.map((m) => ({ value: m.id, label: `${m.childName} · ${m.parentName}` }))]}
            />
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button
          loading={saving}
          disabled={f.phone.replace(/\D/g, '').length < 6}
          onClick={async () => {
            setSaving(true);
            try {
              await api.post('/reception/calls', {
                direction: f.direction,
                phone: f.phone.trim(),
                name: f.name.trim() || undefined,
                purpose: f.purpose.trim() || undefined,
                note: f.note.trim() || undefined,
                enquiryId: enquiryId || undefined,
              });
              toast(t('callLogged'), 'success');
              onDone();
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
    </Modal>
  );
}
