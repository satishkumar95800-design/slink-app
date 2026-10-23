'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';

interface GroundStaff {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  hasAppAccess: boolean;
}

/**
 * Drivers and attendants (ground staff), kept here so a school without petty
 * cash can still run its buses. With live tracking, each driver can be given
 * an app login.
 */
export function GroundStaffCard({ tracking, onChanged }: { tracking: boolean; onChanged: () => void }) {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<GroundStaff[] | null>(null);
  const [editing, setEditing] = useState<GroundStaff | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<GroundStaff[]>('/transport/ground-staff')
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);
  useEffect(load, [load]);

  async function act(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    try {
      await fn();
      toast(done, 'success');
      load();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
            <Users className="h-4 w-4 text-teal" /> {t('staffTitle')}
          </h2>
          <p className="text-xs text-gray-500">{tracking ? t('staffHintTracking') : t('staffHint')}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> {t('addStaff')}
        </Button>
      </div>
      {rows && rows.length === 0 && <p className="mt-4 text-sm text-gray-500">{t('noStaffYet')}</p>}
      <ul className="mt-3 divide-y divide-gray-100">
        {rows?.map((s) => (
          <li key={s.id} className={`flex flex-wrap items-center justify-between gap-2 py-3 text-sm ${s.isActive ? '' : 'opacity-60'}`}>
            <span className="min-w-0">
              <span className="font-semibold text-gray-900">{s.name}</span>
              {!s.isActive && <Badge variant="gray">{t('inactive')}</Badge>}
              <span className="block text-xs text-gray-500">{s.phone ?? t('noPhone')}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {tracking && s.isActive && s.hasAppAccess && <Badge variant="green">{t('canSignIn')}</Badge>}
              {tracking && s.isActive && (
                <Button
                  size="sm"
                  variant={s.hasAppAccess ? 'ghost' : 'secondary'}
                  disabled={busy === s.id || (!s.hasAppAccess && !s.phone)}
                  onClick={() => {
                    if (s.hasAppAccess && !window.confirm(t('removeAccessConfirm', { name: s.name }))) return;
                    void act(
                      s.id,
                      () => (s.hasAppAccess ? api.delete(`/transport/driver-access/${s.id}`) : api.post(`/transport/driver-access/${s.id}`, {})),
                      s.hasAppAccess ? t('accessRemoved', { name: s.name }) : t('accessGiven', { name: s.name }),
                    );
                  }}
                >
                  {s.hasAppAccess ? t('removeAccess') : t('giveAccess')}
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label={t('editStaff', { name: s.name })} onClick={() => setEditing(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <StaffModal
          staff={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
    </section>
  );
}

function StaffModal({ staff, onClose, onSaved }: { staff: GroundStaff | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [f, setF] = useState({ name: staff?.name ?? '', phone: staff?.phone ?? '', notes: staff?.notes ?? '' });
  const [saving, setSaving] = useState(false);
  const phoneOk = !f.phone.trim() || /^\+[0-9\s()-]{6,20}$/.test(f.phone.trim());

  async function save(extra: { isActive?: boolean } = {}) {
    setSaving(true);
    try {
      const body = { name: f.name.trim(), phone: f.phone.trim(), notes: f.notes.trim(), ...extra };
      if (staff) await api.patch(`/transport/ground-staff/${staff.id}`, body);
      else await api.post('/transport/ground-staff', body);
      toast(staff ? t('staffSaved') : t('staffAdded'), 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={staff ? t('editStaffTitle') : t('addStaff')}>
      <div className="space-y-3">
        <Input label={t('staffName')} required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input
          label={t('staffPhone')}
          inputMode="tel"
          maxLength={20}
          value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })}
          placeholder="+919876543210"
          error={phoneOk ? undefined : t('staffPhoneInvalid')}
        />
        <Input label={t('staffNotes')} maxLength={500} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder={t('staffNotesPlaceholder')} />
        {staff?.hasAppAccess && <p className="text-xs text-orange-700">{t('phoneChangeRemovesAccess')}</p>}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        {staff ? (
          <Button variant="ghost" disabled={saving} onClick={() => save({ isActive: !staff.isActive })}>
            {staff.isActive ? t('deactivate') : t('reactivate')}
          </Button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button loading={saving} disabled={!f.name.trim() || !phoneOk} onClick={() => save()}>
            {t('save')}
          </Button>
        </span>
      </div>
    </Modal>
  );
}
