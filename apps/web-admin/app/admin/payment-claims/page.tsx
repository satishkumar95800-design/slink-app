'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { Badge } from '../../../components/ui/badge';
import { useToast } from '../../../components/ui/toast';
import { formatRupees } from '../../../lib/format';

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

const MODE_LABELS: Record<ClaimMode, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  upi: 'UPI',
};

const STATUS_BADGE: Record<ClaimStatus, { label: string; variant: 'yellow' | 'green' | 'red' }> = {
  pending: { label: 'Pending', variant: 'yellow' },
  approved: { label: 'Approved', variant: 'green' },
  rejected: { label: 'Rejected', variant: 'red' },
};

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function PaymentClaimsPage() {
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
      setError((e as Error).message);
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
      toast((e as ApiError).message, 'error');
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
      toast('Enter an amount to approve this claim', 'error');
      return;
    }
    const body: { amount?: number } = {};
    if (trimmed && (needsAmount || parseFloat(trimmed) !== parseFloat(approveTarget.claimedAmount ?? '0'))) {
      body.amount = parseFloat(trimmed);
    }
    try {
      setApproving(true);
      await api.post(`/payment-claims/${approveTarget.id}/approve`, body);
      toast('Claim approved and receipt recorded', 'success');
      setClaims((prev) => prev.filter((c) => c.id !== approveTarget.id));
      closeApprove();
    } catch (e) {
      toast((e as ApiError).message, 'error');
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
      toast('Claim rejected', 'success');
      setClaims((prev) => prev.filter((c) => c.id !== rejectTarget.id));
      closeReject();
    } catch (e) {
      toast((e as ApiError).message, 'error');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Payment Claims</h1>
          <p className="text-sm text-gray-500">
            Review offline payments parents have claimed to have made — approve to record the receipt, or reject with a reason.
          </p>
        </div>
        <div className="w-full sm:w-40">
          <Select
            options={STATUS_OPTIONS}
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
          title="No claims here"
          description="There are no payment claims matching this filter right now."
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{claim.student.name}</h3>
                    <span className="text-xs text-gray-400">#{claim.student.admissionNo}</span>
                    <Badge variant={STATUS_BADGE[claim.status].variant}>
                      {STATUS_BADGE[claim.status].label}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    Claimed amount:{' '}
                    <span className="font-medium text-gray-900">
                      {claim.claimedAmount ? formatRupees(claim.claimedAmount) : 'not specified'}
                    </span>
                    {claim.claimedDate && (
                      <span className="text-gray-400">
                        {' '}
                        · {new Date(claim.claimedDate).toLocaleDateString('en-IN')}
                      </span>
                    )}
                    {claim.claimedMode && (
                      <span className="text-gray-400"> · {MODE_LABELS[claim.claimedMode]}</span>
                    )}
                  </div>
                  {claim.note && <p className="text-sm text-gray-500">Note: {claim.note}</p>}
                  <p className="text-xs text-gray-400">
                    Submitted by {claim.submitter.name}
                    {claim.submitter.phone ? ` · ${claim.submitter.phone}` : ''} on{' '}
                    {new Date(claim.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-400">
                    Outstanding on fee: {formatRupees(
                      (parseFloat(claim.studentFee.amountDue) - parseFloat(claim.studentFee.amountPaid)).toFixed(2),
                    )}
                  </p>
                  {claim.reviewNote && (
                    <p className="text-xs text-gray-500">Review note: {claim.reviewNote}</p>
                  )}
                  {claim.reviewer && (
                    <p className="text-xs text-gray-400">Reviewed by {claim.reviewer.name}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onViewProof(claim)}>
                    View Proof
                  </Button>
                  {claim.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={() => openReject(claim)}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => openApprove(claim)}>
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!approveTarget} onClose={closeApprove} title="Approve Payment Claim">
        {approveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm the amount to record for <span className="font-medium text-gray-900">{approveTarget.student.name}</span>{' '}
              before approving. This will create a receipt and mark the fee accordingly.
            </p>
            <Input
              label="Amount to confirm" required
              type="number"
              step="0.01"
              min="0"
              placeholder={approveTarget.claimedAmount ? undefined : 'Enter amount'}
              value={approveAmount}
              onChange={(e) => setApproveAmount(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={closeApprove}>
                Cancel
              </Button>
              <Button type="button" loading={approving} onClick={onConfirmApprove}>
                Confirm Approval
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejectTarget} onClose={closeReject} title="Reject Payment Claim">
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Optionally add a reason — the parent will be notified.
            </p>
            <Input
              label="Reason (optional)"
              placeholder="e.g. Proof unclear, please resubmit"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={closeReject}>
                Cancel
              </Button>
              <Button variant="danger" type="button" loading={rejecting} onClick={onConfirmReject}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
