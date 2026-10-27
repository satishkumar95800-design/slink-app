'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';
import { Select } from '../../../components/ui/select';
import { useToast } from '../../../components/ui/toast';
import {
  PLANS,
  PLAN_VARIANT,
  STATUS_LABEL,
  STATUS_VARIANT,
  Subscription,
  SubscriptionStatus,
  daysText,
  dmy,
  inr,
  oneYearFrom,
  TRIAL_DAYS,
  todayYmd,
  trialEndsOn,
} from '../plans';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  subscription: Subscription;
  _count: { users: number; students: number };
}



const schema = z.object({
  slug: z
    .string()
    .min(3, 'At least 3 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, digits, and hyphens only'),
  name: z.string().min(2, 'Name is required'),
  plan: z.enum(['basic', 'premium', 'premium_max']),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  trial: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function TenantsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Links from the dashboard open the list already filtered.
  const [plan, setPlan] = useState(() =>
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('plan') ?? ''),
  );
  const [status, setStatus] = useState<SubscriptionStatus | ''>(() =>
    typeof window === 'undefined'
      ? ''
      : ((new URLSearchParams(window.location.search).get('subscription') ?? '') as SubscriptionStatus | ''),
  );
  const [showModal, setShowModal] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { plan: 'basic', startsOn: todayYmd(), trial: false } });
  const chosenPlan = PLANS.find((p) => p.key === watch('plan'));
  const startsOn = watch('startsOn');

  async function fetchTenants(q: string) {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (q) params.set('search', q);
      if (plan) params.set('plan', plan);
      if (status) params.set('subscription', status);
      const query = `?${params}`;
      const res = await api.get<{ data: Tenant[]; total: number }>(`/tenants${query}`);
      setTenants(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not load tenants', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => fetchTenants(search), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, plan, status]);

  async function onCreate(data: FormData) {
    try {
      const tenant = await api.post<Tenant>('/tenants', data);
      toast(`"${tenant.name}" created`, 'success');
      setShowModal(false);
      reset({ plan: 'basic', startsOn: todayYmd(), trial: false, name: '', slug: '' });
      router.push(`/platform/tenants/${tenant.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create tenant', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Tenants</h1>
          <p className="text-sm text-gray-500">{total} school{total === 1 ? '' : 's'} on this platform</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ New tenant</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-sm">
          <Input placeholder="Search by name or slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-44">
          <Select
            aria-label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="All plans"
            options={PLANS.map((p) => ({ value: p.key, label: p.name }))}
          />
        </div>
        <div className="w-48">
          <Select
            aria-label="Subscription"
            value={status}
            onChange={(e) => setStatus(e.target.value as SubscriptionStatus | '')}
            placeholder="Any subscription"
            options={(Object.keys(STATUS_LABEL) as SubscriptionStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }))}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex justify-center p-10">
            <Spinner className="h-6 w-6 text-teal" />
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState
            title="No tenants found"
            description={search ? 'Try a different search.' : 'Create the first school tenant to get started.'}
            action={!search && <Button onClick={() => setShowModal(true)}>+ New tenant</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
<table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Subscription ends</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/platform/tenants/${t.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    <p className="font-mono text-xs text-gray-500">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={PLAN_VARIANT[t.subscription.plan]}>{t.subscription.planName}</Badge>
                    {t.subscription.addOns.length > 0 && <p className="mt-1 text-xs text-gray-500">+ add-ons</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {t._count.students.toLocaleString('en-IN')}
                    {t.subscription.yearlyAmount.extraStudents > 0 && (
                      <p className="text-xs font-semibold text-amber-700">{t.subscription.yearlyAmount.extraStudents} over limit</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{dmy(t.subscription.endsOn)}</p>
                    <p className={`text-xs ${t.subscription.status === 'active' ? 'text-gray-500' : 'font-semibold text-red-600'}`}>
                      {daysText(t.subscription)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {!t.isActive ? (
                        <Badge variant="gray">Inactive</Badge>
                      ) : (
                        <Badge variant={STATUS_VARIANT[t.subscription.status]}>{STATUS_LABEL[t.subscription.status]}</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New tenant">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <Input
            label="School name" required
            placeholder="Greenfield Academy"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="Slug" required
            placeholder="greenfield-academy"
            helpText="Used in the login screen and, later, as the subdomain."
            error={errors.slug?.message}
            {...register('slug')}
          />
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-800">Plan</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLANS.map((p) => (
                <label
                  key={p.key}
                  className={`cursor-pointer rounded-xl border-2 px-3 py-2 text-sm ${
                    watch('plan') === p.key ? 'border-teal bg-teal/5' : 'border-gray-200 bg-white'
                  }`}
                >
                  <input type="radio" value={p.key} className="sr-only" {...register('plan')} />
                  <span className="block font-bold text-gray-900">{p.name}</span>
                  <span className="block text-xs text-gray-500">{inr(p.price)} / year</span>
                </label>
              ))}
            </div>
          </div>
          <Input
            label="Subscription starts"
            type="date"
            required
            error={errors.startsOn?.message}
            helpText={
              chosenPlan && startsOn
                ? `${watch('trial') ? `Free trial for ${TRIAL_DAYS} days, until ${dmy(trialEndsOn(startsOn))}; switched off the day after unless its paid year is started.` : `Runs one year, until ${dmy(oneYearFrom(startsOn))}.`} ${chosenPlan.key === 'basic' ? 'Core features only; modules can be added later.' : `${chosenPlan.name} modules are switched on.`}`
                : undefined
            }
            {...register('startsOn')}
          />
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-teal" {...register('trial')} />
            <span>
              <span className="font-semibold">Start with a {TRIAL_DAYS}-day free trial</span>
              <span className="block text-xs text-gray-500">Pick Premium Max to let the school try every module.</span>
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
