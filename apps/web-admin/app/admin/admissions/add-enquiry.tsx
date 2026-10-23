'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import { EnquiryFields, FormValues, emptyForm, formValid, toBody } from './enquiry-form';

/** New enquiry modal (admissions page and the front desk). */
export function AddEnquiry({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const t = useTranslations('admissions');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [form, setForm] = useState<FormValues>(emptyForm());
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const created = await api.post<{ id: string }>('/admissions', toBody(form, false));
      toast(t('added'), 'success');
      onDone(created.id);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={t('addEnquiry')} size="lg">
      <div className="space-y-4">
        <EnquiryFields value={form} onChange={setForm} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!formValid(form)} onClick={save}>
            {t('addEnquiry')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
