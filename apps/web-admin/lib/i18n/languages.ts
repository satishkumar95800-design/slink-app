/**
 * Console interface languages (docs/SPEC-languages.md). Adding one means adding
 * messages/<code>.json and its code here — nothing else.
 */
export const LANGUAGES = ['en', 'kn', 'hi'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Each language's own name in its own script, so anyone can find theirs. */
export function nativeName(code: Language): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    if (name) return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    // Older browsers without Intl.DisplayNames fall through.
  }
  return code;
}

/** localStorage: the language shown now (survives logout), and one picked before signing in. */
export const LANGUAGE_KEY = 'slink_language';
export const DEVICE_LANGUAGE_KEY = 'slink_device_language';
