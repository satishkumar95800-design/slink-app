/**
 * Interface languages (docs/SPEC-languages.md). Adding a language means adding
 * its code here plus the apps' translation files — no migration, since the
 * columns are plain VARCHAR.
 */
export const SUPPORTED_LANGUAGES = ['en', 'kn', 'hi'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

/** The user's own choice, then the school's default, then English. */
export function effectiveLanguage(
  preferred: string | null | undefined,
  schoolDefault: string | null | undefined,
): Language {
  if (isLanguage(preferred)) return preferred;
  if (isLanguage(schoolDefault)) return schoolDefault;
  return DEFAULT_LANGUAGE;
}
