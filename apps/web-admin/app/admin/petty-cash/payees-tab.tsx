'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import { Payee, PayeeType, PAYEE_TYPES } from './types';

/** Registered third-party cash recipients (vendors, ground staff). Deactivated, never deleted. */
export function PayeesTab({ payees, onChanged }: { payees: Payee[]; onChanged: () => void }) {
  const t = useTranslations('pettyCash');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [type, setType] = useState<PayeeType>('VENDOR');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Payee | null>(null);
  const [eType, setEType] = useState<PayeeType>('VENDOR');
  const [eName, setEName] = useState('');
  const [ePhone, setEPhone] = useState('');
  const [eNotes, setENotes] = useState('');

  const typeOptions = PAYEE_TYPES.map((v) => ({ value: v, label: t(`payeeType.${v}`) }));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post('/petty-cash/payees', {
        type,
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setName('');
      setPhone('');
      setNotes('');
      toast(t('payeeSaved'), 'success');
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function patch(p: Payee, body: Record<string, unknown>) {
    try {
      await api.patch(`/petty-cash/payees/${p.id}`, body);
      toast(t('payeeSaved'), 'success');
      setEditing(null);
      onChanged();
    } catch (err) {
      toast(errorText(err), 'error');
    }
  }

  function startEdit(p: Payee) {
    setEditing(p);
    setEType(p.type);
    setEName(p.name);
    setEPhone(p.phone ?? '');
    setENotes(p.notes ?? '');
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{t('payeesTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500">{t('payeesHelp')}</p>

      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3">
        <Select label={t('payeeTypeLabel')} value={type} onChange={(e) => setType(e.target.value as PayeeType)} options={typeOptions} />
        <div className="min-w-48 flex-1">
          <Input label={t('payeeName')} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Input label={t('phone')} type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} helpText={tCommon('optional')} />
        <div className="min-w-48 flex-1">
          <Input label={t('notes')} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} helpText={tCommon('optional')} />
        </div>
        <Button type="submit" loading={saving} disabled={!name.trim()}>
          {tCommon('add')}
        </Button>
      </form>

      {payees.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{t('payeesEmpty')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {payees.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="text-sm text-gray-900">
                <span className={p.isActive ? '' : 'text-gray-400'}>{p.name}</span>
                <span className="ml-2">
                  <Badge variant={p.type === 'VENDOR' ? 'blue' : 'purple'}>{t(`payeeType.${p.type}`)}</Badge>
                </span>
                {p.phone && <span className="ml-3 text-gray-500">{p.phone}</span>}
                {!p.isActive && (
                  <span className="ml-2">
                    <Badge variant="gray">{t('inactive')}</Badge>
                  </span>
                )}
                {p.notes && <span className="block text-xs text-gray-500">{p.notes}</span>}
              </span>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                  {tCommon('edit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => patch(p, { isActive: !p.isActive })}>
                  {p.isActive ? t('deactivate') : t('activate')}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('editPayee')}>
        {editing && (
          <div className="space-y-4">
            <Select label={t('payeeTypeLabel')} value={eType} onChange={(e) => setEType(e.target.value as PayeeType)} options={typeOptions} />
            <Input label={t('payeeName')} required maxLength={100} value={eName} onChange={(e) => setEName(e.target.value)} />
            <Input label={t('phone')} type="tel" maxLength={20} value={ePhone} onChange={(e) => setEPhone(e.target.value)} />
            <Input label={t('notes')} maxLength={500} value={eNotes} onChange={(e) => setENotes(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                disabled={!eName.trim()}
                onClick={() => patch(editing, { type: eType, name: eName.trim(), phone: ePhone.trim() || null, notes: eNotes.trim() || null })}
              >
                {tCommon('save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
