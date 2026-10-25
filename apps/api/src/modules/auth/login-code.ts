import { Role } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import type { Language } from '../../common/i18n/languages';

/**
 * Email code at sign-in (MFA) rules, pure so they are unit-tested on their own.
 * Platform logins (super admin, head office) always need a code; a school's
 * password logins need one when the school has the Premium Max flag
 * `loginCodes` and its admin has switched `tenants.login_codes` on.
 */

export const CODE_MINUTES = 10;
export const MAX_TRIES = 5;
export const MAX_SENDS = 3;
export const RESEND_GAP_SECONDS = 30;

const PLATFORM_ROLES: Role[] = [Role.super_admin, Role.head_office];

export function needsLoginCode(
  role: Role,
  school: { features: unknown; loginCodes: boolean } | null,
  platformCodes: boolean,
): boolean {
  if (PLATFORM_ROLES.includes(role)) return platformCodes;
  const features = (school?.features ?? {}) as Record<string, unknown>;
  return features.loginCodes === true && school?.loginCodes === true;
}

/** A 6-digit code, every value equally likely. */
export const newCode = () =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

/** Keyed hash of a code, bound to its challenge so a hash is useless elsewhere. */
export const hashCode = (secret: string, challengeId: string, code: string) =>
  createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');

export function codeMatches(
  secret: string,
  challengeId: string,
  code: string,
  stored: string,
): boolean {
  const given = Buffer.from(hashCode(secret, challengeId, code));
  const want = Buffer.from(stored);
  return given.length === want.length && timingSafeEqual(given, want);
}

/** "ad•••@gvps-demo.in": enough for the person to recognise their mailbox. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return '•••';
  return `${name.slice(0, Math.min(2, name.length))}•••@${domain}`;
}

const EMAIL: Record<
  Language,
  { subject: (c: string) => string; body: (c: string) => string }
> = {
  en: {
    subject: (c) => `${c} is your Schoolinkd sign-in code`,
    body: (c) =>
      `Your Schoolinkd sign-in code is ${c}.\n\nIt works once, for ${CODE_MINUTES} minutes.\n\nIf you did not just try to sign in, someone knows your password: change it now and tell your school admin.`,
  },
  kn: {
    subject: (c) => `${c} ನಿಮ್ಮ Schoolinkd ಲಾಗಿನ್ ಕೋಡ್`,
    body: (c) =>
      `ನಿಮ್ಮ Schoolinkd ಲಾಗಿನ್ ಕೋಡ್ ${c}.\n\nಇದು ಒಮ್ಮೆ ಮಾತ್ರ, ${CODE_MINUTES} ನಿಮಿಷ ಕೆಲಸ ಮಾಡುತ್ತದೆ.\n\nನೀವು ಈಗ ಲಾಗಿನ್ ಮಾಡಲು ಪ್ರಯತ್ನಿಸದಿದ್ದರೆ, ಬೇರೆ ಯಾರಿಗೋ ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ತಿಳಿದಿದೆ: ಈಗಲೇ ಅದನ್ನು ಬದಲಿಸಿ ಮತ್ತು ಶಾಲೆಯ ಅಡ್ಮಿನ್‌ಗೆ ತಿಳಿಸಿ.`,
  },
  hi: {
    subject: (c) => `${c} आपका Schoolinkd साइन-इन कोड है`,
    body: (c) =>
      `आपका Schoolinkd साइन-इन कोड ${c} है।\n\nयह एक ही बार, ${CODE_MINUTES} मिनट तक काम करता है।\n\nअगर आपने अभी साइन इन करने की कोशिश नहीं की, तो किसी को आपका पासवर्ड पता है: इसे अभी बदलें और स्कूल एडमिन को बताएं।`,
  },
};

export const codeEmail = (lang: Language, code: string) => ({
  subject: EMAIL[lang].subject(code),
  body: EMAIL[lang].body(code),
});
