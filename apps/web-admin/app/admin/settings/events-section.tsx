'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import { ConsentDialog, ConsentSummary } from './consent-dialog';

type EventType = 'EVENT' | 'PTM';

interface SchoolEvent {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
}

/** Events and parent-teacher meetings shown on the mobile calendar next to holidays. */
export function EventsSection() {
  const t = useTranslations('schoolEvents');
  const tConsent = useTranslations('consent');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [type, setType] = useState<EventType>('EVENT');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [consents, setConsents] = useState<ConsentSummary[]>([]);
  const [consentFor, setConsentFor] = useState<SchoolEvent | null>(null);

  const loadConsents = useCallback(() => {
    api.get<ConsentSummary[]>('/consent-forms').then(setConsents).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<SchoolEvent[]>('/calendar/events').then(setEvents).catch(() => {});
    loadConsents();
  }, [loadConsents]);

  const consentOf = (event: SchoolEvent) => consents.find((c) => c.event.id === event.id) ?? null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !title.trim()) return;
    setSaving(true);
    try {
      const created = await api.post<SchoolEvent>('/calendar/events', {
        type,
        title: title.trim(),
        startDate,
        ...(endDate ? { endDate } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(venue.trim() ? { venue: venue.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setEvents((prev) => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setTitle('');
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setVenue('');
      setDescription('');
      toast(t('added'), 'success');
      if (askConsent) {
        setAskConsent(false);
        setConsentFor(created);
      }
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(event: SchoolEvent) {
    if (!confirm(t('confirmRemove', { title: event.title }))) return;
    try {
      await api.delete(`/calendar/events/${event.id}`);
      setEvents((prev) => prev.filter((x) => x.id !== event.id));
      toast(t('removed'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  const typeLabel: Record<EventType, string> = { EVENT: t('typeEvent'), PTM: t('typePtm') };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900">{t('sectionTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('sectionHelp')}</p>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <Select
          label={t('type')}
          value={type}
          onChange={(e) => setType(e.target.value as EventType)}
          options={[
            { value: 'EVENT', label: typeLabel.EVENT },
            { value: 'PTM', label: typeLabel.PTM },
          ]}
        />
        <div className="min-w-48 flex-1">
          <Input label={t('titleLabel')} required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <Input label={t('startDate')} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input
          label={t('endDate')}
          type="date"
          min={startDate || undefined}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Input label={t('startTime')} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label={t('endTime')} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        <div className="min-w-48 flex-1">
          <Input label={t('venue')} maxLength={200} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="w-full">
          <Input
            label={t('description')}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <label className="flex w-full cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={askConsent}
            onChange={(e) => setAskConsent(e.target.checked)}
            className="h-4 w-4 accent-coral"
          />
          {tConsent('askConsent')}
        </label>
        <Button type="submit" loading={saving} disabled={!startDate || !title.trim()}>
          {t('add')}
        </Button>
      </form>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-gray-900">
                <span className="mr-3 font-mono text-gray-500">
                  {formatDateOnly(event.startDate)}
                  {event.endDate !== event.startDate && ` – ${formatDateOnly(event.endDate)}`}
                </span>
                <span className="mr-2 rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal">
                  {typeLabel[event.type]}
                </span>
                {event.title}
                {event.startTime && (
                  <span className="ml-2 text-gray-500">
                    {event.startTime}
                    {event.endTime && ` – ${event.endTime}`}
                  </span>
                )}
                {event.venue && <span className="ml-2 text-gray-500">· {event.venue}</span>}
              </span>
              <span className="flex flex-shrink-0 items-center gap-2">
                {consentOf(event) && (
                  <span className="whitespace-nowrap rounded-full bg-coral/10 px-2 py-0.5 text-xs font-medium text-coral-dark">
                    {tConsent('badge', {
                      signed: consentOf(event)!.counts.approved + consentOf(event)!.counts.declined,
                      total: consentOf(event)!.counts.total,
                    })}
                  </span>
                )}
                <Button variant="secondary" size="sm" onClick={() => setConsentFor(event)}>
                  {consentOf(event) ? tConsent('button') : tConsent('buttonNew')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(event)}>
                  {t('remove')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {consentFor && (
        <ConsentDialog
          event={consentFor}
          form={consentOf(consentFor)}
          onClose={() => setConsentFor(null)}
          onChanged={loadConsents}
        />
      )}
    </div>
  );
}
