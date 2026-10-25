'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../components/ui/toast';

export interface LoginCodesSetting {
  enabled: boolean;
  /** False when the server can't send email, so codes can't be switched on. */
  mailReady: boolean;
  /** Password logins of the school the code would apply to. */
  covered: number;
}

/** Settings → Sign-in security: an emailed code at every console sign-in (Premium Max). */
export function LoginCodesSection({ data, onSaved }: { data: LoginCodesSetting | null; onSaved: (d: LoginCodesSetting) => void }) {
  const t = useTranslations('settings.loginCodes');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function save(enabled: boolean) {
    setSaving(true);
    try {
      const next = await api.put<LoginCodesSetting>('/security/login-codes', { enabled });
      onSaved(next);
      toast(enabled ? t('turnedOn') : t('turnedOff'), 'success');
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 text-sm ${data.enabled ? 'border-green-200 bg-green-50 text-green-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
        <p className="font-semibold">{data.enabled ? t('isOn') : t('isOff')}</p>
        <p className="mt-1">{t('covers', { n: data.covered })}</p>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600">
        <li>{t('how1')}</li>
        <li>{t('how2')}</li>
        <li>{t('how3')}</li>
      </ul>
      {!data.mailReady && !data.enabled && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('mailOff')}</p>}
      <div className="flex justify-end">
        {data.enabled ? (
          <Button variant="secondary" loading={saving} onClick={() => save(false)}>
            {t('turnOff')}
          </Button>
        ) : (
          <Button loading={saving} disabled={!data.mailReady} onClick={() => save(true)}>
            {t('turnOn')}
          </Button>
        )}
      </div>
    </div>
  );
}
