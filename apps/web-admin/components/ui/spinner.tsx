'use client';

import { useTranslations } from 'next-intl';

export function Spinner({ className = '' }: { className?: string }) {
  const t = useTranslations('common');
  return (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label={t('loading')}
    />
  );
}
