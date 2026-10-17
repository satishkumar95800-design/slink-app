'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { RenewModal } from '../renew-modal';
import { PLAN_VARIANT, STATUS_LABEL, STATUS_VARIANT, Subscription, daysText, dmy, inr } from '../plans';

interface Due {
  id: string;
  name: string;
  slug: string;
  students: number;
  subscription: Subscription;
}

/** Schools from 30 days before their end date until renewed (including switched off), soonest first. */
export default function RenewalsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Due[] | null>(null);
  const [renewing, setRenewing] = useState<Due | null>(null);

  const load = useCallback(() => {
    api
      .get<Due[]>('/platform/renewals')
      .then(setRows)
      .catch((err) => {
        setRows([]);
        toast(err instanceof ApiError ? err.message : 'Could not load renewals', 'error');
      });
  }, [toast]);
  useEffect(load, [load]);

  const total = (rows ?? []).reduce((s, r) => s + r.subscription.yearlyAmount.total, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Renewals</h1>
        <p className="text-sm text-gray-500">
          Schools whose subscription ends within 30 days, is in its 7-day grace period, or has been switched off.
          {rows && rows.length > 0 && ` ${inr(total)} due in all.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {!rows ? (
          <div className="flex justify-center p-10">
            <Spinner className="h-6 w-6 text-teal" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing due" description="No subscription ends in the next 30 days." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Students</th>
                  <th className="px-4 py-3 font-medium">Ends</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/platform/tenants/${r.id}`} className="font-medium text-gray-900 hover:underline">
                        {r.name}
                      </Link>
                      <p className="font-mono text-xs text-gray-500">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={PLAN_VARIANT[r.subscription.plan]}>{r.subscription.planName}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.students.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{dmy(r.subscription.endsOn)}</p>
                      <p className={`text-xs ${r.subscription.daysLeft < 0 ? 'font-semibold text-red-600' : 'text-gray-500'}`}>{daysText(r.subscription)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[r.subscription.status]}>{STATUS_LABEL[r.subscription.status]}</Badge>
                      {r.subscription.status === 'grace' && (
                        <p className="mt-1 text-xs text-orange-700">Off in {r.subscription.graceDaysLeft} day{r.subscription.graceDaysLeft === 1 ? '' : 's'}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{inr(r.subscription.yearlyAmount.total)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => setRenewing(r)}>
                        Mark renewed
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {renewing && (
        <RenewModal
          tenantId={renewing.id}
          tenantName={renewing.name}
          subscription={renewing.subscription}
          onClose={() => setRenewing(null)}
          onDone={() => {
            setRenewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
