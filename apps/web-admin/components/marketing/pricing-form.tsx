'use client';

import { useState } from 'react';
import { CheckCircle2, Mail } from 'lucide-react';
import { strings } from '../../lib/strings';
import { track } from '../../lib/track';
import { isIndianMobile } from './contact-form';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
const t = strings.marketing.pricing;

const FIELD = 'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30';

/** School name, email and phone; the price list PDF is emailed to that address (POST /public/pricing). */
export function PricingForm() {
  const [form, setForm] = useState({ schoolName: '', email: '', phone: '', website: '' });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error' | 'emailFailed'>('idle');
  const [sentTo, setSentTo] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isIndianMobile(form.phone)) {
      setPhoneError(t.invalidPhone);
      return;
    }
    setPhoneError(null);
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/public/pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website: form.website || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        setStatus(body?.error?.code === 'PRICING_EMAIL_FAILED' ? 'emailFailed' : 'error');
        return;
      }
      track('pricing_download');
      setSentTo(form.email.trim());
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-green-200 bg-green-50 p-8 text-center" role="status">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <p className="text-lg font-semibold break-words text-green-900">{t.success(sentTo)}</p>
        <p className="max-w-md text-sm text-green-800">{t.successHint}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-8">
      <h3 className="text-lg font-extrabold text-gray-900">{t.formTitle}</h3>
      <p className="mt-1 text-sm text-gray-600">{t.formBody}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.school}</span>
          <input required minLength={2} maxLength={150} autoComplete="organization" value={form.schoolName} onChange={set('schoolName')} className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.email}</span>
          <input required type="email" maxLength={150} autoComplete="email" value={form.email} onChange={set('email')} className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.phone}</span>
          <input
            required
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            value={form.phone}
            onChange={set('phone')}
            aria-invalid={phoneError ? true : undefined}
            className={`mt-1 ${FIELD} ${phoneError ? 'border-red-500' : ''}`}
          />
          <span className={`mt-1 block text-xs ${phoneError ? 'text-red-600' : 'text-gray-500'}`}>{phoneError ?? t.phoneHint}</span>
        </label>
      </div>
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={set('website')} className="hidden" />
      {(status === 'error' || status === 'emailFailed') && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{status === 'emailFailed' ? t.emailFailed : t.error}</p>
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-coral/20 transition-colors hover:bg-coral-dark disabled:opacity-60"
        >
          <Mail className="h-4 w-4" aria-hidden />
          {status === 'sending' ? t.sending : t.submit}
        </button>
        <p className="text-xs text-gray-500">{t.privacy}</p>
      </div>
    </form>
  );
}
