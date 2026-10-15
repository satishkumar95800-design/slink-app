'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { ApiError } from '../api-client';

/** API error codes the console has its own (translated) text for — see messages/en.json "errors". */
const KNOWN_CODES = [
  'NETWORK_ERROR',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'PARENT_USE_OTP',
  'SCHOOL_NOT_FOUND',
  'FEATURE_DISABLED',
  'NOTHING_OUTSTANDING',
  'AI_UNAVAILABLE',
  'INSUFFICIENT_FLOAT',
  'OVER_SETTLE',
  'RECEIPT_REQUIRED',
  'SELF_APPROVAL',
  'NOT_PENDING',
  'VOID_NEEDS_APPROVER',
  'VOID_NOT_CREATOR',
  'HAS_SETTLEMENTS',
  'CATEGORY_EXISTS',
  'CATEGORY_IN_USE',
  'SETTLE_BEFORE_DISBURSEMENT',
  'SETTLES_NOT_FOUND',
] as const;
type KnownCode = (typeof KNOWN_CODES)[number];

function isKnown(code: string | undefined): code is KnownCode {
  return !!code && (KNOWN_CODES as readonly string[]).includes(code);
}

/**
 * `errorText(err, fallback)`: translated text for known API error codes, the
 * server's own (English) message for other API errors, else `fallback`.
 */
export function useErrorText() {
  const t = useTranslations('errors');
  return useCallback(
    (err: unknown, fallback?: string): string => {
      if (err instanceof ApiError) {
        if (isKnown(err.code)) return t(err.code);
        if (err.message) return err.message;
      }
      return fallback ?? t('generic');
    },
    [t],
  );
}
