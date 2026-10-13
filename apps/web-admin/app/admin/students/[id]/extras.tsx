'use client';

/**
 * Student page sections that only some schools use: their own extra fields
 * (e.g. SATS Number), the transfer certificate, and percentage concessions.
 * Each renders nothing when the school hasn't set it up.
 */

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { api, apiUpload } from '../../../../lib/api-client';
import { useErrorText } from '../../../../lib/i18n/errors';
import { formatDateOnly, formatRupees, toAmount } from '../../../../lib/format';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { useToast } from '../../../../components/ui/toast';

// ─── Extra fields ────────────────────────────────────────────────────────────

interface FieldDefinition {
  id: string;
  label: string;
  fieldType: 'text' | 'number' | 'dropdown';
  options: string[] | null;
}

export interface CustomFieldValue {
  value: string;
  fieldDefinition: { id: string };
}

export function CustomFieldsCard({
  studentId,
  values,
  canEdit,
}: {
  studentId: string;
  values: CustomFieldValue[];
  canEdit: boolean;
}) {
  const t = useTranslations('customFields');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const saved = () => Object.fromEntries(values.map((v) => [v.fieldDefinition.id, v.value]));
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<FieldDefinition[]>('/custom-field-definitions').then(setDefinitions).catch(() => {});
  }, []);

  if (definitions.length === 0) return null;

  async function save() {
    try {
      setSaving(true);
      await api.patch(`/students/${studentId}/custom-fields`, {
        values: definitions.map((d) => ({ fieldDefinitionId: d.id, value: (draft[d.id] ?? '').trim() })),
      });
      toast(t('saved'), 'success');
      setEditing(false);
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t('studentTitle')}</h3>
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {tCommon('edit')}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {definitions.map((d) =>
          editing ? (
            d.fieldType === 'dropdown' ? (
              <Select
                key={d.id}
                label={d.label}
                value={draft[d.id] ?? ''}
                onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))}
                placeholder={tCommon('notSet')}
                options={(d.options ?? []).map((o) => ({ value: o, label: o }))}
              />
            ) : (
              <Input
                key={d.id}
                label={d.label}
                type={d.fieldType === 'number' ? 'number' : 'text'}
                maxLength={500}
                value={draft[d.id] ?? ''}
                onChange={(e) => setDraft((p) => ({ ...p, [d.id]: e.target.value }))}
              />
            )
          ) : (
            <div key={d.id}>
              <p className="text-sm text-gray-500">{d.label}</p>
              <p className="text-base font-medium text-gray-900">{draft[d.id] || t('notSet')}</p>
            </div>
          ),
        )}
      </div>
      {editing && (
        <div className="mt-4 flex gap-2">
          <Button loading={saving} onClick={save}>
            {tCommon('save')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(saved());
              setEditing(false);
            }}
          >
            {tCommon('cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Transfer certificate ────────────────────────────────────────────────────

export function TransferCertificateCard({
  studentId,
  initialKey,
  initialUploadedAt,
  canEdit,
}: {
  studentId: string;
  initialKey: string | null;
  initialUploadedAt: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations('transferCertificate');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileKey, setFileKey] = useState(initialKey);
  const [uploadedAt, setUploadedAt] = useState(initialUploadedAt);
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const uploaded = await apiUpload<{ key: string }>('/files/upload', file, {
        category: 'transfer_certificate',
        entityId: studentId,
      });
      const saved = await api.put<{ tcFileKey: string; tcUploadedAt: string }>(
        `/transfer-certificates/${studentId}`,
        { fileKey: uploaded.key },
      );
      setFileKey(saved.tcFileKey);
      setUploadedAt(saved.tcUploadedAt);
      toast(t('uploaded'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function view() {
    if (!fileKey) return;
    // Open the tab first so the pop-up blocker allows it, then point it at the signed link.
    const tab = window.open('', '_blank');
    try {
      const { url } = await api.get<{ url: string }>(`/files/signed-url?key=${encodeURIComponent(fileKey)}`);
      if (tab) tab.location.href = url;
    } catch (err) {
      tab?.close();
      toast(errorText(err), 'error');
    }
  }

  async function remove() {
    if (!confirm(t('confirmRemove'))) return;
    try {
      setBusy(true);
      await api.delete(`/transfer-certificates/${studentId}`);
      setFileKey(null);
      setUploadedAt(null);
      toast(t('removed'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900">{t('title')}</h3>
      <p className="mt-1 text-sm text-gray-600">
        {fileKey ? (uploadedAt ? t('attachedOn', { date: formatDateOnly(uploadedAt) }) : '') : t('none')}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fileKey && (
          <Button variant="secondary" size="sm" onClick={view}>
            {t('view')}
          </Button>
        )}
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={onFile}
            />
            <Button size="sm" loading={busy} onClick={() => fileRef.current?.click()}>
              {fileKey ? t('replace') : t('upload')}
            </Button>
            {fileKey && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={remove}>
                {t('remove')}
              </Button>
            )}
          </>
        )}
      </div>
      {canEdit && <p className="mt-2 text-xs text-gray-400">{t('fileHint')}</p>}
    </div>
  );
}

// ─── Concessions ─────────────────────────────────────────────────────────────

export interface ConcessionFeeComponent {
  id: string;
  periodLabel: string;
  dueDate: string;
  amountDue: number | string;
  amountPaid: number | string;
  status: string;
  feeItem: { id?: string; label: string };
}

interface Concession {
  id: string;
  percentage: string | number;
  amount: string | number;
  reason: string | null;
  givenOn: string;
  feeItem: { label: string } | null;
}

const toPaise = (v: number | string) => Math.round(toAmount(v) * 100);

/** Unpaid paise on a component (waived ones count as nothing). */
function unpaidPaise(c: ConcessionFeeComponent): number {
  if (c.status === 'waived') return 0;
  return Math.max(0, toPaise(c.amountDue) - toPaise(c.amountPaid));
}

export function ConcessionPanel({
  studentId,
  studentName,
  components,
  onApplied,
}: {
  studentId: string;
  studentName: string;
  components: ConcessionFeeComponent[];
  onApplied: () => void;
}) {
  const t = useTranslations('concession');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [history, setHistory] = useState<Concession[]>([]);
  const [percentage, setPercentage] = useState('');
  const [feeItemId, setFeeItemId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    api
      .get<Concession[]>(`/fee-concessions?studentId=${studentId}`)
      .then(setHistory)
      .catch(() => {
        // History is secondary — the form still works without it.
      });
  }, [studentId, historyVersion]);

  const feeItems = [
    ...new Map(
      components.filter((c) => c.feeItem.id).map((c) => [c.feeItem.id as string, c.feeItem.label]),
    ),
  ];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcoming = components
    .filter((c) => unpaidPaise(c) > 0 && c.dueDate.slice(0, 10) >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const pct = Number(percentage);
  const pctValid = Number.isFinite(pct) && pct >= 0.01 && pct <= 100;
  // Same rule as the API: percentage of each covered component's unpaid balance, rounded to paise.
  const previewPaise = pctValid
    ? components
        .filter((c) => !feeItemId || c.feeItem.id === feeItemId)
        .reduce((sum, c) => sum + Math.round((unpaidPaise(c) * pct) / 100), 0)
    : 0;

  async function submit() {
    if (!pctValid) {
      toast(t('invalidPercentage'), 'error');
      return;
    }
    const amount = formatRupees(previewPaise / 100);
    if (!confirm(t('confirm', { pct, amount, name: studentName }))) return;
    try {
      setSaving(true);
      const created = await api.post<Concession>('/fee-concessions', {
        studentId,
        percentage: pct,
        ...(feeItemId ? { feeItemId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast(t('applied', { amount: formatRupees(created.amount) }), 'success');
      setPercentage('');
      setReason('');
      setHistoryVersion((n) => n + 1);
      onApplied();
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900">{t('upcoming')}</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('upcomingNone')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {upcoming.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-700">
                  {c.feeItem.label} · {c.periodLabel}
                  <span className="ml-2 text-xs text-gray-500">{formatDateOnly(c.dueDate)}</span>
                </span>
                <span className="font-semibold text-gray-900">{formatRupees(unpaidPaise(c) / 100)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{t('title')}</h3>
          <p className="mt-1 text-xs text-gray-500">{t('help')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('percentage')}
            type="number"
            min={0.01}
            max={100}
            step={0.01}
            required
            placeholder={t('percentagePlaceholder')}
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
          />
          <Select
            label={t('feeItem')}
            value={feeItemId}
            onChange={(e) => setFeeItemId(e.target.value)}
            options={[
              { value: '', label: t('allComponents') },
              ...feeItems.map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <Input
          label={t('reason')}
          maxLength={500}
          placeholder={t('reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {pctValid && (
          <p className="text-sm font-medium text-teal">{t('preview', { amount: formatRupees(previewPaise / 100) })}</p>
        )}
        <Button loading={saving} disabled={!pctValid || previewPaise === 0} onClick={submit}>
          {t('submit')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900">{t('history')}</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('noHistory')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {history.map((h) => (
              <li key={h.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">
                    {t('historyLine', {
                      pct: toAmount(h.percentage),
                      scope: h.feeItem?.label ?? t('allComponents'),
                      amount: formatRupees(h.amount),
                    })}
                  </span>
                  <span className="text-xs text-gray-500">{formatDateOnly(h.givenOn)}</span>
                </div>
                {h.reason && <p className="mt-0.5 text-xs text-gray-500">{h.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
