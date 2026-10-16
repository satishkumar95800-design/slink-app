'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { EMPLOYMENT_TYPES, StaffUser } from './types';

/** One click: an employee record from an existing teacher, admin or accounts login. */
export function FromUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('roles');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [userId, setUserId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [type, setType] = useState('PERMANENT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<StaffUser[]>('/hrms/employees/staff-users')
      .then(setUsers)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.post('/hrms/employees/from-user', {
        userId,
        ...(designation.trim() ? { designation: designation.trim() } : {}),
        ...(department.trim() ? { department: department.trim() } : {}),
        employmentType: type,
      });
      toast(t('employeeSaved'), 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('fromStaffUser')}>
      {!users ? (
        <div className="flex h-24 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">{t('noUnlinkedStaff')}</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('fromStaffUserHelp')}</p>
          <Select
            label={t('staffUser')}
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={t('chooseStaffUser')}
            options={users.map((u) => ({ value: u.id, label: `${u.name} (${tRoles(u.role as 'teacher')})` }))}
          />
          <Input label={t('colDesignation')} value={designation} onChange={(e) => setDesignation(e.target.value)} helpText={t('designationDefaultHelp')} maxLength={100} />
          <Input label={t('colDepartment')} value={department} onChange={(e) => setDepartment(e.target.value)} helpText={tCommon('optional')} maxLength={100} />
          <Select label={t('colType')} value={type} onChange={(e) => setType(e.target.value)} options={EMPLOYMENT_TYPES.map((x) => ({ value: x, label: t(`employmentType.${x}`) }))} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button loading={saving} disabled={!userId} onClick={save}>
              {t('createEmployee')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
