'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { claimStatusLabel, paymentMethodLabel } from '../../../lib/i18n/labels';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { Badge } from '../../../components/ui/badge';
import { useToast } from '../../../components/ui/toast';
import { formatDate, formatDateOnly, formatRupees } from '../../../lib/format';

type ClaimStatus = 'pending' | 'approved' | 'rejected';
type ClaimMode = 'cash' | 'cheque' | 'bank_transfer' | 'upi';

interface PaymentClaim {
  id: string;
  fileKey: string;
  claimedAmount: string | null;
  claimedDate: string | null;
  claimedMode: ClaimMode | null;
  note: string | null;
  status: ClaimStatus;
  reviewNote: string | null;
  createdAt: string;
  student: { id: string; name: string; admissionNo: string };
  studentFee: { id: string; amountDue: string; amountPaid: string; status: string };
  submitter: { id: string; name: string; phone: string | null };
  reviewer: { id: string; name: string } | null;
}

const STATUS_VARIANT: Record<ClaimStatus, 'yellow' | 'green' | 'red'> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

export default function PaymentClaimsPage() {
  const t = useTranslations('paymentClaims');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('claimStatus');
  const tMethod = useTranslations('paymentMethod');
  const errorText = useErrorText();
  const statusOptions = [
    ...(['pending', 'approved', 'rejected'] as const).map((value) => ({ value, label: tStatus(value) })),
    { value: 'all', label: t('filterAll') },
  ];
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] = useState<PaymentClaim | null>(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approving, setApproving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<PaymentClaim | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  async function fetchClaims() {
    try {
      setLoading(true);
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const res = await api.get<PaymentClaim[]>(`/payment-claims${query}`);
      setClaims(res);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function onViewProof(claim: PaymentClaim) {
    try {
      const { url } = await api.get<{ url: string }>(`/payment-claims/${claim.id}/proof-url`);
      window.open(url, '_blank');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  function openApprove(claim: PaymentClaim) {
    setApproveTarget(claim);
    setApproveAmount(claim.claimedAmount ?? '');
  }

  function closeApprove() {
    setApproveTarget(null);
    setApproveAmount('');
  }

  async function onConfirmApprove() {
    if (!approveTarget) return;
    const needsAmount = !approveTarget.claimedAmount;
    const trimmed = approveAmount.trim();
    if (needsAmount && !trimmed) {
      toast(t('enterAmount'), 'error');
      return;
    }
    const body: { amount?: number } = {};
    if (trimmed && (needsAmount || parseFloat(trimmed) !== parseFloat(approveTarget.claimedAmount ?? '0'))) {
      body.amount = parseFloat(trimmed);
    }
    try {
      setApproving(true);
      await api.post(`/payment-claims/${approveTarget.id}/approve`, body);
      toast(t('approved'), 'success');
      setClaims((prev) => prev.filter((c) => c.id !== approveTarget.id));
      closeApprove();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setApproving(false);
    }
  }

  function openReject(claim: PaymentClaim) {
    setRejectTarget(claim);
    setRejectNote('');
  }

  function closeReject() {
    setRejectTarget(null);
    setRejectNote('');
  }

  async function onConfirmReject() {
    if (!rejectTarget) return;
    try {
      setRejecting(true);
      await api.post(`/payment-claims/${rejectTarget.id}/reject`, {
        reviewNote: rejectNote.trim() || undefined,
      });
      toast(t('rejected'), 'success');
      setClaims((prev) => prev.filter((c) => c.id !== rejectTarget.id));
      closeReject();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>
        <div className="w-full sm:w-40">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : claims.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{claim.student.name}</h3>
                    <span className="text-xs text-gray-400">#{claim.student.admissionNo}</span>
                    <Badge variant={STATUS_VARIANT[claim.status]}>{claimStatusLabel(tStatus, claim.status)}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('claimedAmount')}{' '}
                    <span className="font-medium text-gray-900">
                      {claim.claimedAmount ? formatRupees(claim.claimedAmount) : t('notSpecified')}
                    </span>
                    {claim.claimedDate && (
                      <span className="text-gray-400">
                        {' '}
                        · {formatDateOnly(claim.claimedDate)}
                      </span>
                    )}
                    {claim.claimedMode && (
                      <span className="text-gray-400"> · {paymentMethodLabel(tMethod, claim.claimedMode)}</span>
                    )}
                  </div>
                  {claim.note && <p className="text-sm text-gray-500">{t('note', { note: claim.note })}</p>}
                  <p className="text-xs text-gray-400">
                    {claim.submitter.phone
                      ? t('submittedByWithPhone', { name: claim.submitter.name, phone: claim.submitter.phone, date: formatDate(claim.createdAt) })
                      : t('submittedBy', { name: claim.submitter.name, date: formatDate(claim.createdAt) })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('outstanding', {
                      amount: formatRupees(
                        (parseFloat(claim.studentFee.amountDue) - parseFloat(claim.studentFee.amountPaid)).toFixed(2),
                      ),
                    })}
                  </p>
                  {claim.reviewNote && (
                    <p className="text-xs text-gray-500">{t('reviewNote', { note: claim.reviewNote })}</p>
                  )}
                  {claim.reviewer && (
                    <p className="text-xs text-gray-400">{t('reviewedBy', { name: claim.reviewer.name })}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onViewProof(claim)}>
                    {t('viewProof')}
                  </Button>
                  {claim.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => openReject(claim)}>
                        {t('reject')}
                      </Button>
                      <Button size="sm" onClick={() => openApprove(claim)}>
                        {t('approve')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!approveTarget} onClose={closeApprove} title={t('approveTitle')}>
        {approveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {t.rich('approveExplainer', {
                name: approveTarget.student.name,
                strong: (chunks) => <span className="font-medium text-gray-900">{chunks}</span>,
              })}
            </p>
            <Input
              label={t('amountToConfirm')} required
              type="number"
              step="0.01"
              min="0"
              placeholder={approveTarget.claimedAmount ? undefined : t('amountPlaceholder')}
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={closeApprove}>
                {tCommon('cancel')}
              </Button>
              <Button type="button" loading={approving} onClick={onConfirmApprove}>
                {t('confirmApproval')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectTarget} onClose={closeReject} title={t('rejectTitle')}>
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('rejectExplainer')}</p>
            <Input
              label={t('reason')}
              placeholder={t('reasonPlaceholder')}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={closeReject}>
                {tCommon('cancel')}
              </Button>
              <Button variant="danger" type="button" loading={rejecting} onClick={onConfirmReject}>
                {t('confirmRejection')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
