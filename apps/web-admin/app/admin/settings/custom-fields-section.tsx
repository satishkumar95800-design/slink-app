'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';

export interface FieldDefinition {
  id: string;
  label: string;
  fieldType: 'text' | 'number' | 'dropdown';
}

/** The school's own extra student fields (e.g. SATS Number) — schools without any see nothing extra elsewhere. */
export function CustomFieldsSection({ onChanged }: { onChanged?: () => void }) {
  const t = useTranslations('customFields');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number'>('text');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<FieldDefinition[]>('/custom-field-definitions').then(setFields).catch(() => {});
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (label.trim().length < 2) return;
    setSaving(true);
    try {
      const created = await api.post<FieldDefinition>('/custom-field-definitions', {
        label: label.trim(),
        fieldType,
        sortOrder: fields.length,
      });
      setFields((prev) => [...prev, created]);
      setLabel('');
      toast(t('added'), 'success');
      onChanged?.();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(field: FieldDefinition) {
    if (!confirm(t('confirmRemove', { label: field.label }))) return;
    try {
      await api.delete(`/custom-field-definitions/${field.id}`);
      setFields((prev) => prev.filter((x) => x.id !== field.id));
      toast(t('removed'), 'success');
      onChanged?.();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  const typeLabel = { text: t('typeText'), number: t('typeNumber'), dropdown: t('typeText') };

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Input
            label={t('label')}
            required
            minLength={2}
            maxLength={100}
            placeholder={t('labelPlaceholder')}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Select
          label={t('type')}
          value={fieldType}
          onChange={(e) => setFieldType(e.target.value as 'text' | 'number')}
          options={[
            { value: 'text', label: t('typeText') },
            { value: 'number', label: t('typeNumber') },
          ]}
        />
        <Button type="submit" loading={saving} disabled={label.trim().length < 2}>
          {t('add')}
        </Button>
      </form>

      {fields.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {fields.map((field) => (
            <li key={field.id} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-900">
                {field.label}
                <span className="ml-2 text-xs text-gray-500">{typeLabel[field.fieldType]}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(field)}>
                {tCommon('remove')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
