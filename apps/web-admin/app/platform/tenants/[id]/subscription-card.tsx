'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../../lib/api-client';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Modal } from '../../../../components/ui/modal';
import { useToast } from '../../../../components/ui/toast';
import { RenewModal } from '../../renew-modal';
import { PLAN_VARIANT, STATUS_LABEL, STATUS_VARIANT, Subscription, daysText, dmy, inr } from '../../plans';

interface Renewal {
  id: string;
  planName: string;
  startsOn: string;
  endsOn: string;
  amount: string | null;
  reference: string | null;
  note: string | null;
  renewedBy: string;
  createdAt: string;
}

/** Plan, period, status, amount at renewal and renewal history (docs/SPEC-subscriptions.md). */
export function SubscriptionCard({
  tenant,
  onSaved,
}: {
  tenant: { id: string; name: string; subscription: Subscription };
  onSaved: () => void;
}) {
  const s = tenant.subscription;
  const [history, setHistory] = useState<Renewal[] | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api.get<Renewal[]>(`/tenants/${tenant.id}/renewals`).then(setHistory).catch(() => setHistory([]));
  }, [tenant.id, s.endsOn]);

  const a = s.yearlyAmount;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Subscription</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={PLAN_VARIANT[s.plan]}>{s.planName}</Badge>
            {s.addOns.length > 0 && <Badge variant="gray">+ add-ons</Badge>}
            <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit dates
          </Button>
          <Button size="sm" onClick={() => setRenewing(true)}>
            {s.onTrial ? 'Start paid year' : 'Mark renewed'}
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Period</dt>
          <dd className="mt-0.5 text-gray-900">
            {dmy(s.startsOn)} – {dmy(s.endsOn)}
          </dd>
          <dd className={`text-xs ${s.status === 'active' ? 'text-gray-500' : 'font-semibold text-red-600'}`}>{daysText(s)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Amount at renewal</dt>
          <dd className="mt-0.5 font-semibold text-gray-900">{inr(a.total)}</dd>
          <dd className="text-xs text-gray-500">
            {a.groupDiscountPercent ? `Group branch ${inr(a.plan)} − ${a.groupDiscountPercent}%` : `Plan ${inr(a.plan)}`}
            {a.addOns > 0 && ` + add-ons ${inr(a.addOns)}`}
            {a.extraStudents > 0 && ` + ${a.extraStudents} extra students ${inr(a.extraStudentsAmount)}`}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">When it ends</dt>
          <dd className="mt-0.5 text-xs text-gray-600">
            {s.onTrial
              ? 'Free trial: no grace. The day after it ends the school is switched off until its paid year starts.'
              : 'Renewals list from 30 days before. 7 days of grace after the end date, then the school is switched off until renewed.'}
          </dd>
        </div>
      </dl>

      {s.status === 'grace' && (
        <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-900">
          In grace: the school is switched off in {s.graceDaysLeft} day{s.graceDaysLeft === 1 ? '' : 's'} unless renewed.
        </p>
      )}
      {s.status === 'trial' && (
        <p className="mt-3 rounded-xl bg-teal/5 px-3 py-2 text-sm text-teal">
          On a free trial. &ldquo;Start paid year&rdquo; begins the paid year the day after the trial (today if it has ended).
        </p>
      )}
      {s.status === 'expired' && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          Switched off: staff and parents can&apos;t sign in. Data is kept; marking it renewed switches it back on at once.
        </p>
      )}

      {history && history.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Renewal history</p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {history.map((r) => (
              <li key={r.id}>
                {dmy(r.startsOn)} – {dmy(r.endsOn)} · {r.planName}
                {r.amount && ` · ${inr(Number(r.amount))}`}
                {r.reference && ` · ${r.reference}`}
                <span className="text-xs text-gray-500">
                  {' '}
                  · by {r.renewedBy} on {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  {r.note && ` · ${r.note}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {renewing && (
        <RenewModal
          tenantId={tenant.id}
          tenantName={tenant.name}
          subscription={s}
          onClose={() => setRenewing(false)}
          onDone={() => {
            setRenewing(false);
            onSaved();
          }}
        />
      )}
      {editing && (
        <EditDatesModal
          tenantId={tenant.id}
          subscription={s}
          onClose={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function EditDatesModal({
  tenantId,
  subscription,
  onClose,
  onDone,
}: {
  tenantId: string;
  subscription: Subscription;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [startsOn, setStartsOn] = useState(subscription.startsOn);
  const [endsOn, setEndsOn] = useState(subscription.endsOn);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/tenants/${tenantId}/subscription`, { startsOn, endsOn });
      toast('Subscription dates saved', 'success');
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit subscription dates">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Corrects the current period without recording a renewal. Use Mark renewed when the school has paid.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Starts" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          <Input label="Ends" type="date" min={startsOn} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!startsOn || !endsOn || endsOn < startsOn} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
