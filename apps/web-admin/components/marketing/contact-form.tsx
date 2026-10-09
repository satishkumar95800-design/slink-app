'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { strings } from '../../lib/strings';
import { track } from '../../lib/track';
import { WhatsAppDemoButton } from './cta';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';
const t = strings.marketing.contact;

/** Same rule as the API: 10 digits starting 6–9, optional +91 / 0 prefix and spaces or dashes. */
export function isIndianMobile(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[6-9]\d{9}$/.test(local);
}

const FIELD = 'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-base outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/30';

export function ContactForm() {
  const [form, setForm] = useState({ name: '', schoolName: '', city: '', studentCount: '', phone: '', preferredTime: '', website: '' });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
      const res = await fetch(`${API_BASE}/public/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, studentCount: Number(form.studentCount), preferredTime: form.preferredTime || undefined, website: form.website || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      track('demo_click');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-600" aria-hidden />
        <p className="text-lg font-semibold text-green-900">{t.success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-8" noValidate={false}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.name}</span>
          <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={set('name')} className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.school}</span>
          <input required minLength={2} maxLength={150} autoComplete="organization" value={form.schoolName} onChange={set('schoolName')} className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.city}</span>
          <input required minLength={2} maxLength={80} autoComplete="address-level2" value={form.city} onChange={set('city')} className={`mt-1 ${FIELD}`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.students}</span>
          <input required type="number" inputMode="numeric" min={1} max={20000} value={form.studentCount} onChange={set('studentCount')} className={`mt-1 ${FIELD}`} />
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
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">{t.preferredTime}</span>
          <input maxLength={60} placeholder={t.preferredTimePlaceholder} value={form.preferredTime} onChange={set('preferredTime')} className={`mt-1 ${FIELD}`} />
        </label>
      </div>
      {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={set('website')} className="hidden" />
      {status === 'error' && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t.error}</p>}
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === 'sending'}
          className="inline-flex items-center justify-center rounded-full bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-coral/20 transition-colors hover:bg-coral-dark disabled:opacity-60"
        >
          {status === 'sending' ? t.sending : t.submit}
        </button>
        <span className="text-center text-sm text-gray-500 sm:text-left">{t.or}</span>
        <WhatsAppDemoButton />
      </div>
    </form>
  );
}
