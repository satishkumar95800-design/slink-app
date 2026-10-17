'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import type { Settings } from './types';

export function SettingsTab({ isAdmin, onChanged }: { isAdmin: boolean; onChanged: () => void }) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [budget, setBudget] = useState('');
  const [receiptAbove, setReceiptAbove] = useState('');
  const [overdueDays, setOverdueDays] = useState('');
  const [trackNotes, setTrackNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  function apply(s: Settings) {
    setThreshold(s.approvalThreshold);
    setBudget(s.monthlyBudget ?? '');
    setReceiptAbove(s.receiptRequiredAbove);
    setOverdueDays(String(s.overdueDays));
    setTrackNotes(s.trackDenominations);
  }

  useEffect(() => {
    api
      .get<Settings>('/petty-cash/settings')
      .then((s) => {
        apply(s);
        setLoaded(true);
      })
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const s = await api.put<Settings>('/petty-cash/settings', {
        approvalThreshold: Number(threshold),
        monthlyBudget: budget === '' ? null : Number(budget),
        receiptRequiredAbove: Number(receiptAbove),
        overdueDays: Number(overdueDays),
        trackDenominations: trackNotes,
      });
      apply(s);
      toast(t('settingsSaved'), 'success');
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded)
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const valid = threshold !== '' && receiptAbove !== '' && Number(overdueDays) >= 1 && Number(overdueDays) <= 90;
  return (
    <form onSubmit={save} className="max-w-xl space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{t('settingsTitle')}</h2>
        <p className="mt-1 text-sm text-gray-500">{isAdmin ? t('settingsHelp') : t('settingsAdminOnly')}</p>
      </div>
      <Input label={t('approvalThreshold')} type="number" min="0" step="0.01" required disabled={!isAdmin} value={threshold} onChange={(e) => setThreshold(e.target.value)} helpText={t('approvalThresholdHelp')} />
      <Input label={t('monthlyBudgetLabel')} type="number" min="0" step="0.01" disabled={!isAdmin} value={budget} onChange={(e) => setBudget(e.target.value)} helpText={t('monthlyBudgetHelp')} />
      <Input label={t('receiptAbove')} type="number" min="0" step="0.01" required disabled={!isAdmin} value={receiptAbove} onChange={(e) => setReceiptAbove(e.target.value)} helpText={t('receiptAboveHelp')} />
      <Input label={t('overdueDays')} type="number" min="1" max="90" step="1" required disabled={!isAdmin} value={overdueDays} onChange={(e) => setOverdueDays(e.target.value)} helpText={t('overdueDaysHelp')} />
      <label className={`flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 ${isAdmin ? 'cursor-pointer' : 'opacity-70'}`}>
        <input
          type="checkbox"
          checked={trackNotes}
          disabled={!isAdmin}
          onChange={(e) => setTrackNotes(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-coral"
        />
        <span>
          <span className="block text-sm font-semibold text-gray-800">{t('trackDenominations')}</span>
          <span className="block text-xs text-gray-500">{t('trackDenominationsHelp')}</span>
        </span>
      </label>
      {isAdmin && (
        <Button type="submit" loading={saving} disabled={!valid}>
          {tCommon('save')}
        </Button>
      )}
    </form>
  );
}
