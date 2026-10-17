'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { formatDateOnly, formatDateTime } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { EnquiryFields, FormValues, emptyForm, formValid, toBody } from './enquiry-form';
import { EnquiryDetail, STAGES, STAGE_VARIANT, Stage } from './types';

/** One enquiry: edit details, move it along the pipeline, add notes, see the timeline. */
export function EnquiryDrawerBody({ id, onChanged }: { id: string; onChanged: () => void }) {
  const t = useTranslations('admissions');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [data, setData] = useState<EnquiryDetail | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [losing, setLosing] = useState(false);
  const [lostReason, setLostReason] = useState('');

  const apply = useCallback((d: EnquiryDetail) => {
    setData(d);
    setForm(emptyForm(d));
  }, []);

  useEffect(() => {
    api
      .get<EnquiryDetail>(`/admissions/${id}`)
      .then(apply)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(fn: () => Promise<EnquiryDetail>, done: string) {
    setSaving(true);
    try {
      apply(await fn());
      toast(done, 'success');
      onChanged();
      return true;
    } catch (e) {
      toast(errorText(e), 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (!data)
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const move = (stage: Stage, extra: Record<string, string> = {}) =>
    run(() => api.post<EnquiryDetail>(`/admissions/${id}/stage`, { stage, ...extra }), t('moved', { stage: t(`stages.${stage}`) }));
  const open = data.stage !== 'enrolled' && data.stage !== 'lost';
  const nextStages = STAGES.filter((s) => s !== data.stage && s !== 'lost');

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={STAGE_VARIANT[data.stage]}>{t(`stages.${data.stage}`)}</Badge>
          {data.lostReason && <span className="text-xs text-gray-500">{t('lostBecause', { reason: data.lostReason })}</span>}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('moveTo')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {nextStages.map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={saving} onClick={() => move(s)}>
              {t(`stages.${s}`)}
            </Button>
          ))}
          {data.stage !== 'lost' && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setLosing(true)}>
              {t('markLost')}
            </Button>
          )}
        </div>
        {losing && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-56 flex-1">
              <Input label={t('lostReason')} required maxLength={300} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder={t('lostReasonPlaceholder')} />
            </div>
            <Button
              size="sm"
              variant="danger"
              loading={saving}
              disabled={!lostReason.trim()}
              onClick={async () => {
                if (await move('lost', { lostReason: lostReason.trim() })) {
                  setLosing(false);
                  setLostReason('');
                }
              }}
            >
              {t('markLost')}
            </Button>
          </div>
        )}
        {open && data.nextFollowUpOn && (
          <p className={`mt-3 text-sm ${data.followUpDue ? 'font-semibold text-red-600' : 'text-gray-600'}`}>
            {t('followUpOn', { date: formatDateOnly(data.nextFollowUpOn) })}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <EnquiryFields value={form} onChange={setForm} showTour />
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            loading={saving}
            disabled={!formValid(form)}
            onClick={() => run(() => api.patch<EnquiryDetail>(`/admissions/${id}`, toBody(form, true)), t('saved'))}
          >
            {t('saveDetails')}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-white p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label={t('addNote')} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} />
          </div>
          <Button
            size="sm"
            disabled={!note.trim() || saving}
            onClick={async () => {
              if (await run(() => api.post<EnquiryDetail>(`/admissions/${id}/notes`, { note: note.trim() }), t('noteAdded'))) setNote('');
            }}
          >
            {t('add')}
          </Button>
        </div>
        <ol className="mt-4 space-y-3 border-l-2 border-gray-100 pl-4">
          {data.activities.map((a) => (
            <li key={a.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-teal ring-2 ring-white" />
              <p className="text-gray-900">
                {a.kind === 'created'
                  ? t('activity.created')
                  : a.kind === 'stage' && a.toStage
                    ? t('activity.stage', { from: a.fromStage ? t(`stages.${a.fromStage}`) : '', to: t(`stages.${a.toStage}`) })
                    : a.kind === 'edited'
                      ? t('activity.edited')
                      : t('activity.note')}
              </p>
              {a.note && <p className="text-gray-600">{a.note}</p>}
              <p className="text-xs text-gray-500">{t('activity.by', { name: a.by, date: formatDateTime(a.createdAt) })}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
