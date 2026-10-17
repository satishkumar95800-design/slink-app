'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { useToast } from '../../components/ui/toast';
import { PLANS, PlanKey, Subscription, addDays, dmy, inr, oneYearFrom, todayYmd } from './plans';

/** Mark a school renewed: the new period follows the current one (or starts today once switched off). */
export function RenewModal({
  tenantId,
  tenantName,
  subscription,
  onClose,
  onDone,
}: {
  tenantId: string;
  tenantName: string;
  subscription: Subscription;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const startsOn = subscription.status === 'expired' ? todayYmd() : addDays(subscription.endsOn, 1);
  const [plan, setPlan] = useState<PlanKey>(subscription.plan);
  const [endsOn, setEndsOn] = useState(oneYearFrom(startsOn));
  const [amount, setAmount] = useState(String(subscription.yearlyAmount.total));
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const planChange = plan !== subscription.plan;
  const suggested = planChange
    ? PLANS.find((p) => p.key === plan)!.price
    : subscription.yearlyAmount.total;

  async function save() {
    setSaving(true);
    try {
      await api.post(`/tenants/${tenantId}/renew`, {
        ...(planChange ? { plan } : {}),
        endsOn,
        ...(amount !== '' ? { amount: Number(amount) } : {}),
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast(`${tenantName} renewed until ${dmy(endsOn)}`, 'success');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not renew', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Renew ${tenantName}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Current period ends {dmy(subscription.endsOn)}. The new period starts <strong>{dmy(startsOn)}</strong>
          {subscription.status === 'expired' && ' (today, because the school is switched off)'}.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Plan"
            value={plan}
            onChange={(e) => {
              const next = e.target.value as PlanKey;
              setPlan(next);
              setAmount(String(next === subscription.plan ? subscription.yearlyAmount.total : PLANS.find((p) => p.key === next)!.price));
            }}
            options={PLANS.map((p) => ({ value: p.key, label: `${p.name} · ${inr(p.price)}` }))}
          />
          <Input label="New end date" type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
        </div>
        {planChange && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The school&apos;s modules switch to the {PLANS.find((p) => p.key === plan)!.name} preset.
          </p>
        )}
        <Input
          label="Amount received (₹)"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          helpText={`Suggested ${inr(suggested)}${!planChange && subscription.yearlyAmount.extraStudents > 0 ? ` incl. ${subscription.yearlyAmount.extraStudents} extra students` : ''}, before GST.`}
        />
        <Input label="Payment reference" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR, cheque no." />
        <Input label="Note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!endsOn || endsOn < startsOn} onClick={save}>
            Mark renewed
          </Button>
        </div>
      </div>
    </Modal>
  );
}
