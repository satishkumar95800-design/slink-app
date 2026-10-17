'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useToast } from '../../../components/ui/toast';

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

/** School holidays: skipped for attendance and shown on the mobile calendar. */
export function HolidaysSection({ onChanged }: { onChanged?: () => void }) {
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
      onChanged?.();
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
      onChanged?.();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
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
