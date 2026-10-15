'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { getSession } from '../../../lib/auth';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { Entry, EntryPage, TYPE_VARIANT } from './types';

/** Admin queue: entries above the approval threshold wait here and affect nothing until approved. */
export function ApprovalsTab({ version, onChanged }: { version: number; onChanged: () => void }) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const me = getSession();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Entry | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    api
      .get<EntryPage>('/petty-cash/entries?status=PENDING&limit=100')
      .then((r) => {
        setEntries(r.data);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  async function approve(e: Entry) {
    setBusy(e.id);
    try {
      await api.post(`/petty-cash/entries/${e.id}/approve`, {});
      toast(t('approved'), 'success');
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!rejectTarget) return;
    setBusy(rejectTarget.id);
    try {
      await api.post(`/petty-cash/entries/${rejectTarget.id}/reject`, { reason: reason.trim() });
      toast(t('rejected'), 'success');
      setRejectTarget(null);
      setReason('');
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!entries)
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (entries.length === 0) return <EmptyState title={t('approvalsEmpty')} description={t('approvalsEmptyHelp')} />;

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <div key={e.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={TYPE_VARIANT[e.type]}>{t(`type.${e.type}`)}</Badge>
                <span className="text-base font-semibold text-gray-900">{formatRupees(e.amount)}</span>
                <span className="text-sm text-gray-500">{formatDateOnly(e.date)}</span>
              </div>
              <p className="text-sm text-gray-800">{e.description}</p>
              <p className="text-xs text-gray-500">
                {[e.category?.name, e.recipient?.name].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-gray-500">{t('submittedBy', { name: e.createdBy.name })}</p>
            </div>
            <div className="flex gap-2">
              {e.createdBy.id === me?.id ? (
                <p className="max-w-48 text-xs text-gray-500">{t('cannotApproveOwn')}</p>
              ) : (
                <>
                  <Button size="sm" loading={busy === e.id} onClick={() => approve(e)}>
                    {t('approve')}
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy === e.id} onClick={() => setRejectTarget(e)}>
                    {t('reject')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title={t('rejectTitle')}>
        <div className="space-y-4">
          <Input label={t('rejectReason')} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" loading={!!busy} disabled={reason.trim().length < 3} onClick={reject}>
              {t('reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
