'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isLanguage, LANGUAGES, nativeName } from '../../lib/i18n/languages';
import { useLanguage } from '../../lib/i18n/provider';
import { useToast } from '../ui/toast';

/** Globe + language dropdown. Signed in, the choice is also saved to the account. */
export function LanguageSwitcher({ signedIn, className = '' }: { signedIn: boolean; className?: string }) {
  const t = useTranslations('language');
  const { language, chooseLanguage } = useLanguage();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  return (
    <label className={`inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 sm:text-sm ${className}`}>
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">{t('label')}</span>
      <select
        value={language}
        disabled={saving}
        onChange={async (e) => {
          if (!isLanguage(e.target.value)) return;
          setSaving(true);
          const saved = await chooseLanguage(e.target.value, { signedIn });
          setSaving(false);
          if (!saved) toast(t('saveFailed'), 'error');
        }}
        className="cursor-pointer bg-transparent pr-1 focus:outline-none"
      >
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={code}>
            {nativeName(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
