'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { Spinner } from '../../../components/ui/spinner';
import { EmptyState } from '../../../components/ui/empty-state';

interface ContactRequest {
  id: string;
  name: string;
  schoolName: string;
  city: string;
  studentCount: number;
  phone: string;
  preferredTime: string | null;
  interestedPlan: string | null;
  emailedAt: string | null;
  createdAt: string;
}

interface PricingRequest {
  id: string;
  schoolName: string;
  email: string;
  phone: string;
  emailedAt: string | null;
  createdAt: string;
}

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', premium: 'Premium', gold: 'Gold', unsure: 'Not sure' };

interface SiteStats {
  days: number;
  daily: Array<{ day: string } & Partial<Record<string, number>>>;
  topPages: { path: string; views: number }[];
  emailEnabled: boolean;
}

const EVENTS: { key: string; label: string }[] = [
  { key: 'page_view', label: 'Page views' },
  { key: 'whatsapp_click', label: 'WhatsApp clicks' },
  { key: 'demo_click', label: 'Demo requests' },
  { key: 'contact_submit', label: 'Contact forms' },
  { key: 'pricing_download', label: 'Price lists' },
  { key: 'login_click', label: 'Login clicks' },
  { key: 'video_play', label: 'Video plays' },
];

function ddmmyyyy(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

/** Super-admin view of marketing-site demo requests and cookie-free analytics (Phase 5). */
export default function LeadsPage() {
  const [requests, setRequests] = useState<ContactRequest[] | null>(null);
  const [pricing, setPricing] = useState<PricingRequest[] | null>(null);
  const [stats, setStats] = useState<SiteStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ContactRequest[]>('/platform/contact-requests'),
      api.get<PricingRequest[]>('/platform/pricing-requests'),
      api.get<SiteStats>('/platform/site-stats?days=30'),
    ])
      .then(([r, p, s]) => {
        setRequests(r);
        setPricing(p);
        setStats(s);
      })
      .catch((e) => setError((e as ApiError).message));
  }, []);

  if (error) return <div className="m-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!requests || !pricing || !stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  }

  const totals = Object.fromEntries(EVENTS.map((e) => [e.key, stats.daily.reduce((sum, d) => sum + (d[e.key] ?? 0), 0)]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">Leads &amp; site analytics</h1>
        <p className="text-sm text-gray-500">
          Demo requests and price list downloads from schoolinkd.in, and the last {stats.days} days of cookie-free visit counts.
          {!stats.emailEnabled && ' Email alerts are off — set SMTP_HOST / SMTP_USER / SMTP_PASS on the API to turn them on.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {EVENTS.map((e) => (
          <div key={e.key} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">{e.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{totals[e.key].toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Demo requests ({requests.length})</h2>
        </div>
        {requests.length === 0 ? (
          <EmptyState title="No demo requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  {['Received', 'Name', 'School', 'City', 'Students', 'Phone', 'Preferred time', 'Plan', 'Emailed'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{ddmmyyyy(r.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-700">{r.schoolName}</td>
                    <td className="px-4 py-3 text-gray-700">{r.city}</td>
                    <td className="px-4 py-3 text-gray-700">{r.studentCount.toLocaleString('en-IN')}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <a href={`https://wa.me/${r.phone.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-teal hover:underline">
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.preferredTime ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.interestedPlan ? (PLAN_LABEL[r.interestedPlan] ?? r.interestedPlan) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.emailedAt ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Price list downloads ({pricing.length})</h2>
        </div>
        {pricing.length === 0 ? (
          <EmptyState title="No price list downloads yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                  {['Received', 'School', 'Email', 'Phone', 'Emailed'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pricing.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">{ddmmyyyy(r.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.schoolName}</td>
                    <td className="px-4 py-3 text-gray-700">{r.email}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <a href={`https://wa.me/${r.phone.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" className="font-medium text-teal hover:underline">
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.emailedAt ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Top pages</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {stats.topPages.length === 0 ? (
            <li className="px-6 py-4 text-sm text-gray-500">No visits recorded yet</li>
          ) : (
            stats.topPages.map((p) => (
              <li key={p.path} className="flex justify-between px-6 py-3 text-sm">
                <span className="font-mono text-gray-700">{p.path}</span>
                <span className="font-semibold text-gray-900">{p.views.toLocaleString('en-IN')}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
