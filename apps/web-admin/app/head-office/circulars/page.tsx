'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { formatDateTime } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import type { Circular, Overview } from '../types';

/** Circulars to the group's schools: the one thing a head office can send (docs/SPEC-franchise.md §3). */
export default function CircularsPage() {
  const t = useTranslations('headOffice');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [sent, setSent] = useState<Circular[] | null>(null);
  const [branches, setBranches] = useState<Overview['branches']>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [parents, setParents] = useState(false);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    api.get<Circular[]>('/head-office/circulars').then(setSent).catch(() => setSent([]));
  }, []);
  useEffect(() => {
    load();
    api
      .get<Overview>('/head-office/overview')
      .then((o) => {
        const live = o.branches.filter((b) => b.available);
        setBranches(live);
        setPicked(new Set(live.map((b) => b.id)));
      })
      .catch(() => setPicked(new Set()));
  }, [load]);

  async function send() {
    if (!picked || !confirm(t('circularConfirm', { count: picked.size }))) return;
    setSending(true);
    try {
      await api.post('/head-office/circulars', {
        title: title.trim(),
        body: body.trim(),
        audience: parents ? 'staff_and_parents' : 'staff',
        ...(picked.size < branches.length ? { tenantIds: [...picked] } : {}),
      });
      toast(t('circularSent'), 'success');
      setTitle('');
      setBody('');
      setParents(false);
      setTimeout(load, 1500);
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSending(false);
    }
  }

  const valid = title.trim() && body.trim() && picked && picked.size > 0;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('circularsTitle')}</h1>
        <p className="text-sm text-gray-500">{t('circularsIntro')}</p>
      </div>

      <section className="space-y-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <Input label={t('circularTitle')} required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('circularTitlePlaceholder')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="circular-body" className="text-sm font-semibold text-gray-800">
            {t('circularBody')}
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="circular-body"
            rows={5}
            maxLength={1000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/30"
          />
          <p className="text-right text-xs text-gray-400">{body.length}/1000</p>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-coral" checked={parents} onChange={(e) => setParents(e.target.checked)} />
          <span>
            {t('circularParents')}
            <span className="block text-xs text-gray-500">{t('circularParentsHelp')}</span>
          </span>
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-800">{t('circularSchools')}</p>
          {!picked ? (
            <Spinner className="h-5 w-5 text-teal" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <label key={b.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${picked.has(b.id) ? 'border-teal bg-teal/5 text-teal' : 'border-gray-200 text-gray-600'}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-coral"
                    checked={picked.has(b.id)}
                    onChange={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(b.id)) next.delete(b.id);
                        else next.add(b.id);
                        return next;
                      })
                    }
                  />
                  {b.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button loading={sending} disabled={!valid} onClick={send}>
            <Send className="h-4 w-4" />
            {t('circularSend')}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">{t('circularsSent')}</h2>
        {!sent ? (
          <Spinner className="mt-3 h-6 w-6 text-teal" />
        ) : sent.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('circularsNone')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {sent.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-500">{t('circularBy', { name: c.createdBy, date: formatDateTime(c.createdAt) })}</p>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{c.body}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {c.audience === 'staff_and_parents' ? t('circularToBoth') : t('circularToStaff')} ·{' '}
                  {c.branches
                    .map((b) =>
                      c.audience === 'staff_and_parents'
                        ? t('circularReachBoth', { name: b.name, staff: b.staffCount, parents: b.parentCount })
                        : t('circularReachStaff', { name: b.name, staff: b.staffCount }),
                    )
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
