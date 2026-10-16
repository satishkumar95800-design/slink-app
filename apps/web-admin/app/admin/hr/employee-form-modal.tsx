'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import { EMPLOYMENT_TYPES, Employee, SENSITIVE_FIELDS, SensitiveField } from './types';

/** Add or edit an employee. Sensitive values are write-only here: blank keeps the stored value. */
export function EmployeeFormModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [name, setName] = useState(employee?.name ?? '');
  const [code, setCode] = useState(employee?.employeeCode ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [designation, setDesignation] = useState(employee?.designation ?? '');
  const [department, setDepartment] = useState(employee?.department ?? '');
  const [type, setType] = useState(employee?.employmentType ?? 'PERMANENT');
  const [joinDate, setJoinDate] = useState(employee?.joinDate ?? '');
  const [secret, setSecret] = useState<Record<SensitiveField, string>>({
    pan: '',
    aadhaar: '',
    uan: '',
    esiNumber: '',
    bankAccount: '',
    bankIfsc: '',
    bankHolder: '',
  });
  const [clear, setClear] = useState<SensitiveField[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleClear = (f: SensitiveField) =>
    setClear((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const secrets: Record<string, string> = {};
      for (const f of SENSITIVE_FIELDS) if (secret[f].trim() && !clear.includes(f)) secrets[f] = secret[f].trim();
      if (employee) {
        await api.patch(`/hrms/employees/${employee.id}`, {
          name: name.trim(),
          employeeCode: code.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          designation: designation.trim(),
          department: department.trim() || null,
          employmentType: type,
          joinDate,
          ...secrets,
          ...(clear.length ? { clear } : {}),
        });
      } else {
        await api.post('/hrms/employees', {
          name: name.trim(),
          ...(code.trim() ? { employeeCode: code.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          designation: designation.trim(),
          ...(department.trim() ? { department: department.trim() } : {}),
          employmentType: type,
          joinDate,
          ...secrets,
        });
      }
      toast(t('employeeSaved'), 'success');
      onSaved();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={employee ? t('editEmployee') : t('addEmployee')} size="xl">
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('colName')} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={t('colCode')} maxLength={30} value={code} onChange={(e) => setCode(e.target.value)} helpText={employee ? undefined : t('codeAutoHelp')} required={!!employee} />
          <Input label={t('colDesignation')} required maxLength={100} value={designation} onChange={(e) => setDesignation(e.target.value)} />
          <Input label={t('colDepartment')} maxLength={100} value={department} onChange={(e) => setDepartment(e.target.value)} />
          <Select label={t('colType')} value={type} onChange={(e) => setType(e.target.value as typeof type)} options={EMPLOYMENT_TYPES.map((x) => ({ value: x, label: t(`employmentType.${x}`) }))} />
          <Input label={t('colJoined')} type="date" required value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          <Input label={t('phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={t('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('sensitiveTitle')}</h3>
          <p className="mb-3 text-xs text-gray-500">{employee ? t('sensitiveEditHelp') : t('sensitiveHelp')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SENSITIVE_FIELDS.map((f) => (
              <div key={f}>
                <Input
                  label={t(`field.${f}`)}
                  autoComplete="off"
                  value={secret[f]}
                  disabled={clear.includes(f)}
                  placeholder={employee?.masked[f] ?? ''}
                  onChange={(e) => setSecret({ ...secret, [f]: e.target.value })}
                />
                {employee?.masked[f] && (
                  <label className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <input type="checkbox" checked={clear.includes(f)} onChange={() => toggleClear(f)} />
                    {t('clearStored')}
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim() || !designation.trim() || !joinDate}>
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
