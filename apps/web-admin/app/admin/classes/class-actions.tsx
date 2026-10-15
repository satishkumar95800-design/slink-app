'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';

export interface ClassRow {
  id: string;
  name: string;
  academicYear: string;
  section: string | null;
  _count?: { students: number };
}

const label = (c: ClassRow) => [c.name, c.section].filter(Boolean).join(' ');

/** Rename a class or change its section. */
export function EditClassModal({ cls, onClose, onSaved }: { cls: ClassRow; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [name, setName] = useState(cls.name);
  const [section, setSection] = useState(cls.section ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast(t('nameRequired'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/classes/${cls.id}`, { name: name.trim(), section: section.trim() || undefined });
      toast(t('updated'), 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('editTitle', { name: label(cls) })}>
      <div className="space-y-4">
        <Input label={t('className')} required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={t('section')} value={section} onChange={(e) => setSection(e.target.value)} placeholder={t('sectionPlaceholder')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" loading={saving} onClick={save}>
            {tCommon('saveChanges')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Deletes a class. Its students and their reports, receipts and attendance move
 * to the class picked here (required when it has students) in the same request.
 */
export function DeleteClassModal({
  cls,
  classes,
  onClose,
  onDeleted,
}: {
  cls: ClassRow;
  classes: ClassRow[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const studentCount = cls._count?.students ?? 0;
  const others = classes.filter((c) => c.id !== cls.id);
  // Suggest a class with the same name and section (the usual duplicate case).
  const [targetId, setTargetId] = useState(
    () =>
      others.find((c) => c.name.toLowerCase() === cls.name.toLowerCase() && (c.section ?? '') === (cls.section ?? ''))
        ?.id ?? '',
  );
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (studentCount > 0 && !targetId) {
      toast(t('pickTargetClass'), 'error');
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/classes/${cls.id}${targetId ? `?moveTo=${targetId}` : ''}`);
      toast(t('deleted', { name: label(cls) }), 'success');
      onDeleted();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('deleteTitle', { name: label(cls) })}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700">
          {studentCount === 0 ? t('deleteEmpty') : t('deleteHasStudents', { count: studentCount })}
        </p>
        <Select
          label={t('moveStudentsTo')}
          required={studentCount > 0}
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          options={[
            { value: '', label: studentCount > 0 ? t('pickTargetClass') : t('noMove') },
            ...others.map((c) => ({ value: c.id, label: `${label(c)} · ${c.academicYear}` })),
          ]}
        />
        <p className="text-xs text-gray-500">{t('moveHelp')}</p>
        <p className="text-xs text-gray-500">{tCommon('cannotUndo')}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="danger" type="button" loading={busy} onClick={confirm}>
            {targetId ? t('moveAndDelete') : tCommon('delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
