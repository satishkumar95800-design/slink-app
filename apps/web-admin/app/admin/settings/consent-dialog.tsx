'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';

export type ConsentStatus = 'APPROVED' | 'DECLINED' | 'PENDING';

export interface ConsentSummary {
  id: string;
  event: { id: string; title: string; startDate: string };
  classes: { id: string; name: string }[];
  body: string;
  deadline: string;
  open: boolean;
  counts: { total: number; approved: number; declined: number; pending: number };
}

interface ConsentRow {
  studentId: string;
  studentName: string;
  rollNo: string | null;
  className: string;
  status: ConsentStatus;
  signedName: string | null;
  parentName: string | null;
  signedOn: string | null;
  note: string | null;
}

interface ClassOption {
  id: string;
  name: string;
  section: string | null;
  academicYear: string;
}

interface Props {
  event: { id: string; title: string; startDate: string };
  /** The event's form, or null to create one. */
  form: ConsentSummary | null;
  onClose: () => void;
  /** Called after a form is sent, withdrawn or reminded, to refresh the event list. */
  onChanged: () => void;
}

const STATUS_BADGE: Record<ConsentStatus, 'green' | 'red' | 'yellow'> = {
  APPROVED: 'green',
  DECLINED: 'red',
  PENDING: 'yellow',
};

/** Today in the browser's timezone as YYYY-MM-DD. */
function localToday() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Two days before the event, but never before today. */
function defaultDeadline(eventDate: string) {
  const d = new Date(`${eventDate}T00:00:00`);
  d.setDate(d.getDate() - 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = localToday();
  return ymd < today ? (eventDate < today ? today : eventDate) : ymd;
}

/** Send a consent form for an event to chosen classes, or follow up on one already sent. */
export function ConsentDialog({ event, form, onClose, onChanged }: Props) {
  const t = useTranslations('consent');
  return (
    <Modal open onClose={onClose} size="xl" title={form ? t('viewTitle', { event: event.title }) : t('createTitle')}>
      {form ? (
        <ConsentResults formId={form.id} onChanged={onChanged} onClose={onClose} />
      ) : (
        <ConsentCreate event={event} onChanged={onChanged} onClose={onClose} />
      )}
    </Modal>
  );
}

function ConsentCreate({ event, onChanged, onClose }: { event: Props['event']; onChanged: () => void; onClose: () => void }) {
  const t = useTranslations('consent');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [body, setBody] = useState(() => t('defaultBody', { event: event.title, date: formatDateOnly(event.startDate) }));
  const [deadline, setDeadline] = useState(() => defaultDeadline(event.startDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<ClassOption[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  const manyYears = new Set(classes.map((c) => c.academicYear)).size > 1;
  const label = (c: ClassOption) => [c.name, c.section].filter(Boolean).join(' ');
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = classes.length > 0 && selected.size === classes.length;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      toast(t('chooseClass'), 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await api.post<{ notified: number }>('/consent-forms', {
        eventId: event.id,
        classIds: [...selected],
        body: body.trim(),
        deadline,
      });
      toast(t('sent', { count: created.notified }), 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <p className="text-sm text-gray-600">{t('createIntro')}</p>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{t('classes')}</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(classes.map((c) => c.id)))}
              className="h-4 w-4 accent-coral"
            />
            {t('selectAll')}
          </label>
        </div>
        <div className="grid max-h-44 grid-cols-2 gap-x-4 gap-y-1.5 overflow-y-auto rounded-xl border border-gray-300 bg-white p-3 sm:grid-cols-3">
          {classes.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-700">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-coral" />
              {label(c)}
              {manyYears && <span className="text-xs text-gray-400">{c.academicYear}</span>}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="consent-body" className="mb-1.5 block text-sm font-medium text-gray-700">
          {t('body')}
        </label>
        <textarea
          id="consent-body"
          rows={5}
          minLength={10}
          maxLength={3000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
        />
        <p className="mt-1 text-xs text-gray-500">{t('bodyHelp')}</p>
      </div>
      <Input
        label={t('deadline')}
        type="date"
        required
        min={localToday()}
        max={event.startDate}
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
        helpText={t('deadlineHelp')}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={saving} disabled={selected.size === 0 || body.trim().length < 10 || !deadline}>
          {t('send')}
        </Button>
      </div>
    </form>
  );
}

function ConsentResults({ formId, onChanged, onClose }: { formId: string; onChanged: () => void; onClose: () => void }) {
  const t = useTranslations('consent');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [form, setForm] = useState<(ConsentSummary & { rows: ConsentRow[] }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ConsentStatus | 'ALL'>('ALL');
  const [busy, setBusy] = useState<'remind' | 'download' | 'withdraw' | null>(null);

  const load = useCallback(() => {
    api
      .get<ConsentSummary & { rows: ConsentRow[] }>(`/consent-forms/${formId}`)
      .then(setForm)
      .catch(() => setFailed(true));
  }, [formId]);
  useEffect(load, [load]);

  const rows = useMemo(() => (form ? form.rows.filter((r) => filter === 'ALL' || r.status === filter) : []), [form, filter]);
  const statusLabel: Record<ConsentStatus, string> = { APPROVED: t('approved'), DECLINED: t('declined'), PENDING: t('pending') };

  async function remind() {
    setBusy('remind');
    try {
      const r = await api.post<{ notified: number }>(`/consent-forms/${formId}/remind`, {});
      toast(t('reminded', { count: r.notified }), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    if (!form) return;
    setBusy('download');
    try {
      await apiDownload(`/consent-forms/${formId}?format=csv`, `consent-${form.event.startDate}.csv`);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (!confirm(t('confirmWithdraw'))) return;
    setBusy('withdraw');
    try {
      await api.delete(`/consent-forms/${formId}`);
      toast(t('withdrawn'), 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast(errorText(err), 'error');
      setBusy(null);
    }
  }

  if (failed) return <p className="text-sm text-red-700">{t('loadFailed')}</p>;
  if (!form) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  }

  const answered = form.counts.approved + form.counts.declined;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="green">
          {t('approved')} {form.counts.approved}
        </Badge>
        <Badge variant="red">
          {t('declined')} {form.counts.declined}
        </Badge>
        <Badge variant="yellow">
          {t('pending')} {form.counts.pending}
        </Badge>
        <span className="text-gray-500">
          {form.open ? t('closes', { date: formatDateOnly(form.deadline) }) : t('closed', { date: formatDateOnly(form.deadline) })}
        </span>
      </div>
      <p className="text-sm text-gray-500">{form.classes.map((c) => c.name).join(', ')}</p>
      <blockquote className="whitespace-pre-line rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">{form.body}</blockquote>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          label={t('show')}
          value={filter}
          onChange={(e) => setFilter(e.target.value as ConsentStatus | 'ALL')}
          options={[
            { value: 'ALL', label: t('all') },
            { value: 'PENDING', label: t('pending') },
            { value: 'APPROVED', label: t('approved') },
            { value: 'DECLINED', label: t('declined') },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {form.open && form.counts.pending > 0 && (
            <Button size="sm" loading={busy === 'remind'} onClick={remind}>
              {t('remind')}
            </Button>
          )}
          <Button size="sm" variant="secondary" loading={busy === 'download'} onClick={download}>
            {t('download')}
          </Button>
          {answered === 0 && (
            <Button size="sm" variant="ghost" loading={busy === 'withdraw'} onClick={withdraw}>
              {t('withdraw')}
            </Button>
          )}
        </div>
      </div>

      {form.rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noStudents')}</p>
      ) : (
        <div className="max-h-[45vh] overflow-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="sticky top-0 bg-cream">
              <tr>
                {[t('colClass'), t('colStudent'), t('colAnswer'), t('colSignedBy'), t('colSignedOn'), t('colNote')].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.className}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {r.rollNo && <span className="mr-1.5 text-gray-400">{r.rollNo}</span>}
                    {r.studentName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant={STATUS_BADGE[r.status]}>{statusLabel[r.status]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{r.signedName ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{r.signedOn ? formatDateOnly(r.signedOn) : '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
