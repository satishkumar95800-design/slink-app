'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDate, formatDateOnly } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { Employee, EmployeeDocument, SENSITIVE_FIELDS, SensitiveField } from './types';

export function EmployeeDetailModal({
  id,
  onClose,
  onChanged,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (e: Employee) => void;
}) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [revealed, setRevealed] = useState<Partial<Record<SensitiveField, string>> | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitDate, setExitDate] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [docLabel, setDocLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get<Employee>(`/hrms/employees/${id}`)
      .then(setEmp)
      .catch((e) => toast(errorText(e), 'error'));
    api
      .get<EmployeeDocument[]>(`/hrms/employees/${id}/documents`)
      .then(setDocs)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(load, [load]);

  async function reveal() {
    setRevealing(true);
    try {
      const res = await api.post<{ values: Partial<Record<SensitiveField, string>> }>(`/hrms/employees/${id}/reveal`, {});
      setRevealed(res.values);
      setConfirmReveal(false);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRevealing(false);
    }
  }

  async function exitEmployee() {
    setBusy(true);
    try {
      await api.post(`/hrms/employees/${id}/exit`, { exitDate, ...(exitReason.trim() ? { reason: exitReason.trim() } : {}) });
      toast(t('employeeSaved'), 'success');
      setExitOpen(false);
      load();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    try {
      await api.post(`/hrms/employees/${id}/reactivate`, {});
      toast(t('employeeSaved'), 'success');
      load();
      onChanged();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function uploadDoc(file: File) {
    setBusy(true);
    try {
      await apiUpload(`/hrms/employees/${id}/documents`, file, { label: docLabel.trim() });
      setDocLabel('');
      if (fileRef.current) fileRef.current.value = '';
      toast(t('documentUploaded'), 'success');
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openDoc(d: EmployeeDocument) {
    try {
      const { url } = await api.get<{ url: string }>(`/hrms/employees/${id}/documents/${d.id}/url`);
      window.open(url, '_blank');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  async function deleteDoc(d: EmployeeDocument) {
    if (!window.confirm(t('confirmDeleteDocument', { name: d.label }))) return;
    try {
      await api.delete(`/hrms/employees/${id}/documents/${d.id}`);
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  return (
    <Modal open onClose={onClose} title={emp ? emp.name : t('colName')} size="xl">
      {!emp ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={emp.status === 'ACTIVE' ? 'green' : 'gray'}>{t(`status.${emp.status}`)}</Badge>
            <Badge variant="blue">{t(`employmentType.${emp.employmentType}`)}</Badge>
            <span className="font-mono text-xs text-gray-500">{emp.employeeCode}</span>
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEdit(emp)}>
                {tCommon('edit')}
              </Button>
              {emp.status === 'ACTIVE' ? (
                <Button size="sm" variant="danger" onClick={() => setExitOpen(true)}>
                  {t('markExited')}
                </Button>
              ) : (
                <Button size="sm" loading={busy} onClick={reactivate}>
                  {t('reactivate')}
                </Button>
              )}
            </span>
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {(
              [
                [t('colDesignation'), emp.designation],
                [t('colDepartment'), emp.department ?? '—'],
                [t('colJoined'), formatDateOnly(emp.joinDate)],
                [t('phone'), emp.phone ?? '—'],
                [t('email'), emp.email ?? '—'],
                [t('colLogin'), emp.user ? emp.user.name : t('noLogin')],
                ...(emp.exitDate ? [[t('exitDate'), `${formatDateOnly(emp.exitDate)}${emp.exitReason ? ` — ${emp.exitReason}` : ''}`]] : []),
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-gray-100 py-1">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-right text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{t('sensitiveTitle')}</h3>
              {revealed ? (
                <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                  {t('hideValues')}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirmReveal(true)}>
                  {t('revealValues')}
                </Button>
              )}
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {SENSITIVE_FIELDS.map((f) => (
                <div key={f} className="flex justify-between gap-3 border-b border-gray-100 py-1">
                  <dt className="text-gray-500">{t(`field.${f}`)}</dt>
                  <dd className="font-mono text-xs text-gray-900">{revealed ? (revealed[f] ?? '—') : (emp.masked[f] ?? '—')}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">{t('documentsTitle')}</h3>
            <p className="text-xs text-gray-500">{t('documentsHelp')}</p>
            <ul className="mt-2 divide-y divide-gray-100">
              {docs.length === 0 && <li className="py-2 text-sm text-gray-500">{t('noDocuments')}</li>}
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-gray-900">{d.label}</span>
                    <span className="ml-2 text-gray-500">
                      {d.fileName} · {formatDate(d.uploadedAt)}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openDoc(d)}>
                      {tCommon('view')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteDoc(d)}>
                      {tCommon('delete')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input label={t('documentLabel')} value={docLabel} maxLength={100} onChange={(e) => setDocLabel(e.target.value)} />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                disabled={!docLabel.trim() || busy}
                className="text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadDoc(f);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Modal open={confirmReveal} onClose={() => setConfirmReveal(false)} title={t('revealTitle')} size="sm">
        <p className="text-sm text-gray-700">{t('revealWarning')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReveal(false)}>
            {tCommon('cancel')}
          </Button>
          <Button loading={revealing} onClick={reveal}>
            {t('revealConfirm')}
          </Button>
        </div>
      </Modal>

      <Modal open={exitOpen} onClose={() => setExitOpen(false)} title={t('markExited')} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('exitHelp')}</p>
          <Input label={t('exitDate')} type="date" required value={exitDate} onChange={(e) => setExitDate(e.target.value)} />
          <Input label={t('exitReason')} value={exitReason} maxLength={300} onChange={(e) => setExitReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setExitOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" loading={busy} disabled={!exitDate} onClick={exitEmployee}>
              {t('markExited')}
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
