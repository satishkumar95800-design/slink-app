'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { setSession } from '../../lib/auth';
import type { Role } from '@slink/types';
import { strings } from '../../lib/strings';
import { ApiError } from '../../lib/api-client';
import { useErrorText } from '../../lib/i18n/errors';
import { useLanguage } from '../../lib/i18n/provider';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { homeFor } from '../../lib/roles';

const makeSchema = (t: ReturnType<typeof useTranslations<'login'>>) =>
  z.object({
    tenantId: z.string().optional(),
    email: z.string().email(t('invalidEmail')),
    password: z.string().min(1, t('passwordRequired')),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

interface SignedIn {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string | null;
    role: Role;
    tenantId: string;
    preferredLanguage?: string | null;
    language?: string | null;
  };
}

/** A right password that still needs the code emailed to the user (MFA). */
interface CodeStep {
  challengeId: string;
  sentTo: string;
}

async function post(path: string, body: unknown, tenantId?: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
    body: JSON.stringify(body),
  });
  return { res, body: await res.json().catch(() => ({})) };
}

const apiError = (status: number, body: { error?: { message?: unknown; code?: string }; message?: unknown } | undefined, fallback: string) => {
  const msg = body?.error?.message ?? body?.message ?? fallback;
  return new ApiError(status, Array.isArray(msg) ? msg.join(', ') : String(msg), body, body?.error?.code);
};

export default function LoginPage() {
  const t = useTranslations('login');
  const errorText = useErrorText();
  const { applyAccountLanguage } = useLanguage();
  const schema = useMemo(() => makeSchema(t), [t]);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [step, setStep] = useState<CodeStep | null>(null);

  function finish({ accessToken, refreshToken, user }: SignedIn) {
    setSession({ id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId }, accessToken, refreshToken);
    applyAccountLanguage(user);
    router.push(homeFor(user.role as string));
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const tenantId = data.tenantId?.trim();
      const { res, body } = await post(
        tenantId ? '/auth/email/login' : '/auth/super-admin/login',
        { email: data.email, password: data.password },
        tenantId,
      );
      if (!res.ok) {
        setError(errorText(apiError(res.status, body, t('failed'))));
        return;
      }
      if (body?.codeRequired) {
        setStep({ challengeId: body.challengeId, sentTo: body.sentTo });
        return;
      }
      finish(body as SignedIn);
    } catch {
      setError(errorText(new ApiError(0, '', undefined, 'NETWORK_ERROR')));
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream p-4">
      <Link href="/" aria-label={t('homeLink')} className="absolute left-4 top-4 flex items-center rounded-lg p-1 hover:opacity-80">
        <img src="/schoolinkd-logo.svg" alt={strings.product.name} className="h-7 w-auto" />
      </Link>
      <div className="absolute right-4 top-4">
        <LanguageSwitcher signedIn={false} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/schoolinkd-mark.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{strings.product.name}</h1>
          <span className="mt-2 inline-flex rounded-full bg-coral/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-coral-dark">
            {t('consoleBadge')}
          </span>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-xl sm:p-8">
          <h2 className="mb-6 text-xl font-extrabold text-gray-900">{step ? t('codeTitle') : t('title')}</h2>

          {step ? (
            <CodeForm
              step={step}
              onDone={finish}
              onRestart={() => {
                setStep(null);
                setError(null);
              }}
            />
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label={t('tenantLabel')}
              placeholder={t('tenantPlaceholder')}
              helpText={t('tenantHelp')}
              error={errors.tenantId?.message}
              {...register('tenantId')}
            />
            <Input
              label={t('email')} required
              type="email"
              placeholder={t('emailPlaceholder')}
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label={t('password')} required
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            {error && (
              <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full justify-center" loading={isSubmitting}>
              {t('submit')}
            </Button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

/** Second step: the 6-digit code emailed to the user. */
function CodeForm({ step, onDone, onRestart }: { step: CodeStep; onDone: (s: SignedIn) => void; onRestart: () => void }) {
  const t = useTranslations('login');
  const errorText = useErrorText();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [wait, setWait] = useState(30);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const { res, body } = await post('/auth/login-code/verify', { challengeId: step.challengeId, code });
      if (res.ok) return onDone(body as SignedIn);
      const code_ = body?.error?.code;
      if (code_ === 'LOGIN_CODE_WRONG') setError(t('codeWrong', { n: Number(body?.error?.triesLeft ?? 0) }));
      else {
        if (code_ === 'LOGIN_CODE_EXPIRED') setExpired(true);
        setError(errorText(apiError(res.status, body, t('failed'))));
      }
      setCode('');
    } catch {
      setError(errorText(new ApiError(0, '', undefined, 'NETWORK_ERROR')));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setNote(null);
    try {
      const { res, body } = await post('/auth/login-code/resend', { challengeId: step.challengeId });
      if (res.ok) {
        setNote(t('codeResent', { email: String(body?.sentTo ?? step.sentTo) }));
        setWait(30);
      } else {
        if (body?.error?.code === 'LOGIN_CODE_EXPIRED' || body?.error?.code === 'LOGIN_CODE_TOO_MANY_SENDS') setExpired(true);
        if (body?.error?.code === 'LOGIN_CODE_WAIT') setWait(Number(body?.error?.seconds ?? 30));
        setError(errorText(apiError(res.status, body, t('failed'))));
      }
    } catch {
      setError(errorText(new ApiError(0, '', undefined, 'NETWORK_ERROR')));
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-gray-600">{t('codeSent', { email: step.sentTo })}</p>
      <Input
        label={t('codeLabel')}
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        disabled={expired}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="text-center font-mono text-2xl tracking-[0.5em]"
      />
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {note && <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{note}</div>}
      {expired ? (
        <Button type="button" className="w-full justify-center" onClick={onRestart}>
          {t('codeStartAgain')}
        </Button>
      ) : (
        <Button type="submit" className="w-full justify-center" loading={busy} disabled={code.length !== 6}>
          {t('codeVerify')}
        </Button>
      )}
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onRestart} className="font-semibold text-gray-600 hover:underline">
          {t('codeBack')}
        </button>
        {!expired && (
          <button type="button" onClick={resend} disabled={wait > 0} className="font-semibold text-teal hover:underline disabled:text-gray-400 disabled:no-underline">
            {wait > 0 ? t('codeResendIn', { s: wait }) : t('codeResend')}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">{t('codeHelp')}</p>
    </form>
  );
}
