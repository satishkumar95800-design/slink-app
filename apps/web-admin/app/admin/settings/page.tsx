'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { LanguageSwitcher } from '../../../components/layout/language-switcher';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../components/ui/toast';
import { getSession } from '../../../lib/auth';

interface TenantSelf {
  id: string;
  name: string;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
}

interface UploadResult {
  key: string;
  publicUrl: string | null;
}

type Stage = 'idle' | 'uploading';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tenant, setTenant] = useState<TenantSelf | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    api.get<TenantSelf>('/tenant').then(setTenant).catch(() => setTenant(null));
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage('uploading');
    try {
      const uploaded = await apiUpload<UploadResult>('/files/upload', file, { category: 'background' });
      const updated = await api.patch<TenantSelf>('/tenant', { backgroundImageKey: uploaded.key });
      setTenant(updated);
      toast(t('backgroundUpdated'), 'success');
    } catch (err) {
      toast(errorText(err, t('uploadFailed')), 'error');
    } finally {
      setStage('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900">{t('yourLanguage')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('yourLanguageHelp')}</p>
        <div className="mt-4">
          <LanguageSwitcher signedIn />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-900">{t('branding')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('brandingHelp')}</p>

        <div className="mt-5">
          {tenant?.backgroundImageUrl ? (
            <img
              src={tenant.backgroundImageUrl}
              alt={t('backgroundAlt')}
              className="h-48 w-full rounded-md border object-cover"
            />
          ) : (
            <div className="flex h-48 w-full items-center justify-center rounded-md border border-dashed text-sm text-gray-400">
              {t('noBackground')}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={stage === 'uploading'}
            className="block text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal hover:file:bg-teal/20"
          />
          {stage === 'uploading' && <Button loading disabled>{t('uploading')}</Button>}
        </div>
        <p className="mt-2 text-xs text-gray-400">{t('fileHint')}</p>
      </div>

      {getSession()?.role === 'admin' && <HolidaysSection />}
    </div>
  );
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

function HolidaysSection() {
  const t = useTranslations('holidays');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Holiday[]>('/attendance/holidays').then(setHolidays).catch(() => {});
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !name.trim()) return;
    setSaving(true);
    try {
      const created = await api.post<Holiday>('/attendance/holidays', { date, name: name.trim() });
      setHolidays((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setName('');
      toast(t('added'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(holiday: Holiday) {
    if (!confirm(t('confirmRemove', { name: holiday.name }))) return;
    try {
      await api.delete(`/attendance/holidays/${holiday.id}`);
      setHolidays((prev) => prev.filter((x) => x.id !== holiday.id));
      toast(t('removed'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900">{t('sectionTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('sectionHelp')}</p>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <Input label={t('date')} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="min-w-48 flex-1">
          <Input label={t('name')} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button type="submit" loading={saving} disabled={!date || !name.trim()}>
          {t('add')}
        </Button>
      </form>

      {holidays.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {holidays.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-900">
                <span className="mr-3 font-mono text-gray-500">{formatDateOnly(holiday.date)}</span>
                {holiday.name}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(holiday)}>
                {t('remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
