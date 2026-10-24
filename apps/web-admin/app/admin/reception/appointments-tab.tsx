'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Check, PhoneOutgoing, UserX, X } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { formatDateOnly } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { todayYmd } from './types';

const KINDS = ['interview', 'parent_meeting', 'admission_visit', 'vendor', 'other'] as const;
type Kind = (typeof KINDS)[number];
type Status = 'scheduled' | 'arrived' | 'cancelled' | 'no_show';

interface Appointment {
  id: string;
  kind: Kind;
  name: string;
  phone: string | null;
  withWhom: string | null;
  date: string;
  time: string;
  note: string | null;
  status: Status;
}

const STATUS_VARIANT: Record<Status, 'gray' | 'green' | 'red' | 'orange'> = {
  scheduled: 'gray',
  arrived: 'green',
  cancelled: 'red',
  no_show: 'orange',
};

const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Interviews, parent meetings and other visits booked at the desk: a week from the chosen day. */
export function AppointmentsTab() {
  const t = useTranslations('reception.appointments');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [from, setFrom] = useState(todayYmd());
  const [rows, setRows] = useState<Appointment[] | null>(null);
  const [booking, setBooking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Appointment[]>(`/reception/appointments?from=${from}&to=${addDays(from, 6)}`)
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
  }, [from, errorText, toast]);
  useEffect(load, [load]);

  async function setStatus(a: Appointment, status: Status) {
    setBusy(a.id);
    try {
      await api.patch(`/reception/appointments/${a.id}`, { status });
      toast(t(`marked.${status}`), 'success');
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  const days = rows ? [...new Set(rows.map((r) => r.date))] : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-48">
          <Input type="date" label={t('from')} value={from} onChange={(e) => setFrom(e.target.value || todayYmd())} />
        </div>
        <Button onClick={() => setBooking(true)}>
          <CalendarPlus className="h-4 w-4" /> {t('book')}
        </Button>
      </div>

      {!rows ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        days.map((day) => (
          <div key={day} className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-bold text-gray-900">{day === todayYmd() ? t('today', { date: formatDateOnly(day) }) : formatDateOnly(day)}</h3>
            <ul className="divide-y divide-gray-100">
              {rows
                .filter((r) => r.date === day)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-14 font-mono text-sm font-bold text-gray-900">{a.time}</span>
                    <div className="min-w-48 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900">{a.name}</span>
                        <Badge variant="gray">{t(`kinds.${a.kind}`)}</Badge>
                        {a.status !== 'scheduled' && <Badge variant={STATUS_VARIANT[a.status]}>{t(`status.${a.status}`)}</Badge>}
                      </p>
                      <p className="text-xs text-gray-500">{[a.withWhom ? t('meeting', { who: a.withWhom }) : null, a.phone, a.note].filter(Boolean).join(' · ')}</p>
                    </div>
                    {a.phone && (
                      <a href={`tel:${a.phone}`} className="rounded-full p-2 text-teal hover:bg-teal/10" aria-label={t('call')}>
                        <PhoneOutgoing className="h-4 w-4" />
                      </a>
                    )}
                    {a.status === 'scheduled' && (
                      <span className="flex gap-1">
                        <Button size="sm" variant="secondary" disabled={busy === a.id} onClick={() => setStatus(a, 'arrived')}>
                          <Check className="h-4 w-4" /> {t('arrived')}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => setStatus(a, 'no_show')} title={t('noShow')} aria-label={t('noShow')}>
                          <UserX className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => setStatus(a, 'cancelled')} title={t('cancel')} aria-label={t('cancel')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}

      {booking && (
        <BookModal
          onClose={() => setBooking(false)}
          onDone={() => {
            setBooking(false);
            load();
          }}
        />
      )}
    </section>
  );
}

function BookModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('reception.appointments');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState({ kind: 'interview' as Kind, name: '', phone: '', withWhom: '', date: todayYmd(), time: '10:00', note: '' });
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((v) => ({ ...v, ...patch }));

  async function save() {
    setSaving(true);
    try {
      await api.post('/reception/appointments', {
        kind: f.kind,
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        withWhom: f.withWhom.trim() || undefined,
        date: f.date,
        time: f.time,
        note: f.note.trim() || undefined,
      });
      toast(t('booked'), 'success');
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  const ok = f.name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.date) && /^\d{2}:\d{2}$/.test(f.time);
  return (
    <Modal open onClose={onClose} title={t('book')} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('kind')} value={f.kind} onChange={(e) => set({ kind: e.target.value as Kind })} options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))} />
          <Input label={t('name')} required maxLength={120} value={f.name} onChange={(e) => set({ name: e.target.value })} />
          <Input label={t('phone')} type="tel" maxLength={20} value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          <Input label={t('withWhom')} maxLength={120} value={f.withWhom} onChange={(e) => set({ withWhom: e.target.value })} placeholder={t('withWhomPlaceholder')} />
          <Input label={t('date')} type="date" required value={f.date} onChange={(e) => set({ date: e.target.value })} />
          <Input label={t('time')} type="time" required value={f.time} onChange={(e) => set({ time: e.target.value })} />
        </div>
        <Input label={t('note')} maxLength={300} value={f.note} onChange={(e) => set({ note: e.target.value })} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!ok} onClick={save}>
            {t('book')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
