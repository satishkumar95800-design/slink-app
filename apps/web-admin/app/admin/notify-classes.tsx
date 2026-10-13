'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';

interface ClassOption {
  id: string;
  name: string;
  section: string | null;
}

const classLabel = (c: ClassOption) => [c.name, c.section].filter(Boolean).join(' ');

/**
 * Admin dashboard: push one notice to parents of the chosen classes. Sends one
 * class-targeted notice per class (POST /notifications/broadcast), so each keeps
 * its own "seen by" count like any other notice.
 */
export function NotifyClassesCard() {
  const t = useTranslations('notifyClasses');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<ClassOption[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (selected.size === 0) {
      toast(t('pickClass'), 'error');
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast(t('fillAll'), 'error');
      return;
    }
    if (!confirm(t('confirm', { count: selected.size }))) return;

    setSending(true);
    const targets = classes.filter((c) => selected.has(c.id));
    const results = await Promise.allSettled(
      targets.map((c) =>
        api.post<{ queued: number }>('/notifications/broadcast', {
          channel: 'fcm',
          kind: 'notice',
          targetType: 'class',
          targetId: c.id,
          title: title.trim(),
          body: body.trim(),
        }),
      ),
    );
    setSending(false);

    const queued = results.reduce((n, r) => n + (r.status === 'fulfilled' ? r.value.queued : 0), 0);
    const failed = targets.filter((_, i) => results[i].status === 'rejected');
    if (failed.length === targets.length) {
      const first = results[0];
      toast(errorText(first.status === 'rejected' ? first.reason : undefined), 'error');
      return;
    }
    toast(t('sent', { count: queued }), 'success');
    if (failed.length > 0) {
      toast(t('partFailed', { classes: failed.map(classLabel).join(', ') }), 'error');
      setSelected(new Set(failed.map((c) => c.id)));
      return;
    }
    setSelected(new Set());
    setTitle('');
    setBody('');
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-gray-100">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <p className="mt-0.5 text-xs text-gray-500">{t('help')}</p>
      </div>
      <div className="space-y-4 px-6 py-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">{t('classes')}</p>
            {classes.length > 0 && (
              <div className="flex gap-3 text-xs font-semibold text-teal">
                <button type="button" className="hover:underline" onClick={() => setSelected(new Set(classes.map((c) => c.id)))}>
                  {t('selectAll')}
                </button>
                <button type="button" className="hover:underline" onClick={() => setSelected(new Set())}>
                  {t('clearAll')}
                </button>
              </div>
            )}
          </div>
          {classes.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t('noClasses')}</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {classes.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      on ? 'border-teal bg-teal text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-teal'
                    }`}
                  >
                    {classLabel(c)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Input
          label={t('titleLabel')}
          required
          maxLength={100}
          placeholder={t('titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="notify-classes-body" className="text-sm font-semibold text-gray-800">
            {t('message')}
            <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="notify-classes-body"
            aria-required="true"
            rows={3}
            maxLength={1000}
            value={body}
            placeholder={t('messagePlaceholder')}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30"
          />
        </div>
        <Button loading={sending} disabled={selected.size === 0 || !title.trim() || !body.trim()} onClick={send}>
          {t('send')}
        </Button>
      </div>
    </div>
  );
}
