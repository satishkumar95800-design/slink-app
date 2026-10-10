'use client';

import { NextIntlClientProvider } from 'next-intl';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api-client';
import { DEFAULT_LANGUAGE, DEVICE_LANGUAGE_KEY, isLanguage, Language, LANGUAGE_KEY } from './languages';
import { englishMessages, loadMessages, Messages } from './messages';

function readStored(key: string): Language | null {
  try {
    const v = localStorage.getItem(key);
    return isLanguage(v) ? v : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: Language | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private mode / blocked storage: the language still applies for this visit.
  }
}

interface LanguageContextValue {
  language: Language;
  /** Applies at once. Signed in: also saves to the account (false if that failed). */
  chooseLanguage: (code: Language, opts: { signedIn: boolean }) => Promise<boolean>;
  /** After sign-in: account choice → language picked on the login page → school default. */
  applyAccountLanguage: (user: { preferredLanguage?: string | null; language?: string | null }) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside <ConsoleI18nProvider>');
  return ctx;
}

/**
 * Interface language for the console (docs/SPEC-languages.md). Wraps every
 * console layout — not the marketing site, which stays English and never loads
 * these files.
 */
export function ConsoleI18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState<Messages>(englishMessages);

  const apply = useCallback((code: Language) => {
    setLanguage(code);
    writeStored(LANGUAGE_KEY, code);
  }, []);

  // The language this browser last used. Read after mount — localStorage
  // doesn't exist during server rendering, and the first client render must
  // match the server's English markup.
  useEffect(() => {
    const stored = readStored(LANGUAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
    if (stored && stored !== DEFAULT_LANGUAGE) setLanguage(stored);
  }, []);

  // Another tab switched language: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_KEY && isLanguage(e.newValue)) setLanguage(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.documentElement.lang = language;
    loadMessages(language)
      .then((m) => {
        if (!cancelled) setMessages(m);
      })
      .catch(() => {
        if (!cancelled) setMessages(englishMessages);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const chooseLanguage = useCallback(
    async (code: Language, { signedIn }: { signedIn: boolean }) => {
      apply(code);
      if (!signedIn) {
        writeStored(DEVICE_LANGUAGE_KEY, code);
        return true;
      }
      try {
        await api.patch('/users/me/language', { language: code });
        return true;
      } catch {
        return false;
      }
    },
    [apply],
  );

  const applyAccountLanguage = useCallback(
    (user: { preferredLanguage?: string | null; language?: string | null }) => {
      if (isLanguage(user.preferredLanguage)) {
        apply(user.preferredLanguage);
        return;
      }
      const picked = readStored(DEVICE_LANGUAGE_KEY);
      if (picked) {
        // No language on the account yet: keep the one chosen on the login page and save it.
        apply(picked);
        writeStored(DEVICE_LANGUAGE_KEY, null);
        api.patch('/users/me/language', { language: picked }).catch(() => {});
        return;
      }
      apply(isLanguage(user.language) ? user.language : DEFAULT_LANGUAGE);
    },
    [apply],
  );

  const value = useMemo(
    () => ({ language, chooseLanguage, applyAccountLanguage }),
    [language, chooseLanguage, applyAccountLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider
        locale={language}
        messages={messages}
        timeZone="Asia/Kolkata"
        onError={(err) => {
          if (process.env.NODE_ENV === 'development') console.warn('[i18n]', err.message);
        }}
        getMessageFallback={({ namespace, key }) => [namespace, key].filter(Boolean).join('.')}
      >
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
