'use client';

import { AlertTriangle, IndianRupee, Lightbulb, Power, School, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { ReactNode, useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { Spinner } from '../../../components/ui/spinner';
import { PLANS, PlanKey, STATUS_LABEL, SubscriptionStatus, inr } from '../plans';

interface Suggestion {
  kind: string;
  tone: 'danger' | 'warning' | 'opportunity' | 'info';
  title: string;
  detail: string;
  amount: number | null;
  schools: { id: string; name: string; value: string }[];
}

interface Dashboard {
  today: string;
  totals: {
    schools: number;
    active: number;
    inactive: number;
    students: number;
    staff: number;
    byPlan: Record<PlanKey, number>;
    byStatus: Record<SubscriptionStatus, number>;
  };
  revenue: { contracted: number; byPlan: Record<PlanKey, number>; dueIn30: number; dueIn90: number; overdue: number };
  leads: { last7: number; last30: number };
  suggestions: Suggestion[];
}

const TONE = {
  danger: { card: 'border-red-200', chip: 'bg-red-100 text-red-700', icon: <Power className="h-4 w-4" /> },
  warning: { card: 'border-amber-200', chip: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="h-4 w-4" /> },
  opportunity: { card: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-800', icon: <TrendingUp className="h-4 w-4" /> },
  info: { card: 'border-sky-200', chip: 'bg-sky-100 text-sky-800', icon: <Lightbulb className="h-4 w-4" /> },
} as const;

const STATUS_TONE: Record<SubscriptionStatus, string> = {
  trial: 'text-teal',
  active: 'text-emerald-700',
  renewal_due: 'text-amber-700',
  grace: 'text-orange-700',
  expired: 'text-red-700',
};

function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-gray-500">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal/10 text-teal">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/** The platform team's landing page: schools, revenue under contract, renewals and what to do next. */
export default function PlatformDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>('/platform/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the dashboard'));
  }, []);

  if (error) return <div className="mx-auto max-w-6xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data)
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );

  const { totals, revenue } = data;
  const statuses: SubscriptionStatus[] = ['trial', 'active', 'renewal_due', 'grace', 'expired'];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Every school on Schoolinkd, what they pay, and what needs doing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<School className="h-4 w-4" />} label="Schools" value={String(totals.active)} sub={totals.inactive ? `${totals.inactive} deactivated` : 'All active'} />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Students"
          value={totals.students.toLocaleString('en-IN')}
          sub={`${totals.staff.toLocaleString('en-IN')} staff`}
        />
        <Kpi icon={<IndianRupee className="h-4 w-4" />} label="Yearly revenue" value={inr(revenue.contracted)} sub="Under contract, before GST" />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Up for renewal"
          value={inr(revenue.dueIn30)}
          sub={`Next 30 days · ${inr(revenue.dueIn90)} in 90 days${revenue.overdue ? ` · ${inr(revenue.overdue)} overdue` : ''}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900">Schools by plan</h2>
          <ul className="mt-3 space-y-3">
            {PLANS.map((p) => {
              const count = totals.byPlan[p.key];
              const share = totals.active ? count / totals.active : 0;
              return (
                <li key={p.key}>
                  <Link href={`/platform/tenants?plan=${p.key}`} className="flex items-center justify-between text-sm hover:underline">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-gray-600">
                      {count} school{count === 1 ? '' : 's'} · {inr(revenue.byPlan[p.key])}
                    </span>
                  </Link>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-teal" style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Subscriptions</h2>
            <Link href="/platform/renewals" className="text-sm font-semibold text-teal underline">
              Renewals
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {statuses.map((s) => (
              <Link key={s} href={`/platform/tenants?subscription=${s}`} className="rounded-2xl border border-gray-100 p-3 hover:border-gray-300">
                <p className={`text-2xl font-extrabold ${STATUS_TONE[s]}`}>{totals.byStatus[s]}</p>
                <p className="text-xs font-semibold text-gray-600">{STATUS_LABEL[s]}</p>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Leads: {data.leads.last7} in the last 7 days, {data.leads.last30} in 30 days ·{' '}
            <Link href="/platform/leads" className="underline">
              open Leads
            </Link>
          </p>
        </section>
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-500">
          <Lightbulb className="h-4 w-4" /> Suggestions
        </h2>
        {data.suggestions.length === 0 ? (
          <p className="rounded-3xl border border-black/5 bg-white p-6 text-sm text-gray-600 shadow-sm">Nothing needs attention right now.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.suggestions.map((s) => (
              <SuggestionCard key={s.kind} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [all, setAll] = useState(false);
  const tone = TONE[s.tone];
  const shown = all ? s.schools : s.schools.slice(0, 6);
  return (
    <article className={`rounded-3xl border bg-white p-5 shadow-sm ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>{tone.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              {s.title}
              {s.schools.length > 0 && <span className="font-normal text-gray-500"> · {s.schools.length}</span>}
            </h3>
            <p className="mt-0.5 text-sm text-gray-600">{s.detail}</p>
          </div>
        </div>
        {s.amount ? <p className="shrink-0 text-sm font-extrabold text-gray-900">{inr(s.amount)}</p> : null}
      </div>
      {s.kind === 'follow_up_leads' ? (
        <Link href="/platform/leads" className="mt-3 inline-block text-sm font-semibold text-teal underline">
          Open Leads
        </Link>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {shown.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <Link href={`/platform/tenants/${x.id}`} className="truncate font-medium text-gray-900 hover:underline">
                {x.name}
              </Link>
              <span className="shrink-0 text-xs text-gray-500">{x.value}</span>
            </li>
          ))}
        </ul>
      )}
      {s.schools.length > 6 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 cursor-pointer text-xs font-semibold text-teal underline">
          {all ? 'Show fewer' : `Show all ${s.schools.length}`}
        </button>
      )}
    </article>
  );
}
