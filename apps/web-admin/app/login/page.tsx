'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
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

const makeSchema = (t: ReturnType<typeof useTranslations<'login'>>) =>
  z.object({
    tenantId: z.string().optional(),
    email: z.string().email(t('invalidEmail')),
    password: z.string().min(1, t('passwordRequired')),
  });

type FormData = z.infer<ReturnType<typeof makeSchema>>;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

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

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const tenantId = data.tenantId?.trim();
      const res = await fetch(
        `${API_BASE}${tenantId ? '/auth/email/login' : '/auth/super-admin/login'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
          },
          body: JSON.stringify({ email: data.email, password: data.password }),
        },
      );

      const body = await res.json();

      if (!res.ok) {
        const msg = body?.error?.message ?? body?.message ?? t('failed');
        setError(errorText(new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg, body, body?.error?.code)));
        return;
      }

      const { accessToken, refreshToken, user } = body as {
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
      };

      setSession(
        { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
        accessToken,
        refreshToken,
      );
      applyAccountLanguage(user);

      router.push(user.role === 'super_admin' ? '/platform/tenants' : '/admin');
    } catch {
      setError(errorText(new ApiError(0, '', undefined, 'NETWORK_ERROR')));
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher signedIn={false} />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal text-xl font-extrabold text-white">
            S
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{strings.product.name}</h1>
          <span className="mt-2 inline-flex rounded-full bg-coral/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-coral-dark">
            {t('consoleBadge')}
          </span>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-xl sm:p-8">
          <h2 className="mb-6 text-xl font-extrabold text-gray-900">{t('title')}</h2>

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
        </div>
      </div>
    </div>
  );
}
