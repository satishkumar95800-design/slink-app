'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { clearSession, getSession, isLoggedIn } from '../../lib/auth';
import { ConsoleI18nProvider } from '../../lib/i18n/provider';
import { LanguageSwitcher } from '../../components/layout/language-switcher';
import { ToastProvider } from '../../components/ui/toast';

/** Head office (franchise) console: read-only view of the group's schools. */
export default function HeadOfficeLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleI18nProvider>
      <Shell>{children}</Shell>
    </ConsoleI18nProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations('headOffice');
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState<string | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    const session = getSession();
    if (!isLoggedIn() || !session) {
      router.replace('/login');
      return;
    }
    if ((session.role as string) !== 'head_office') {
      router.replace(session.role === 'super_admin' ? '/platform/dashboard' : '/admin');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session is read after hydration
    setName(session.name);
  }, [router]);

  if (!name)
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
      </div>
    );

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-cream">
        <header className="flex h-16 flex-shrink-0 items-center justify-between gap-2 bg-teal px-3 sm:px-6">
          <Link href="/head-office" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-1">
              <img src="/schoolinkd-mark.svg" alt="" className="h-full w-full" />
            </span>
            <span className="truncate text-sm font-bold text-white">{t('title')}</span>

          </Link>
          <nav className="flex items-center gap-1">
            {[
              { href: '/head-office', label: t('navOverview'), active: !pathname.startsWith('/head-office/circulars') },
              { href: '/head-office/circulars', label: t('navCirculars'), active: pathname.startsWith('/head-office/circulars') },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${item.active ? 'bg-coral text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-white md:inline">{name}</span>
            <LanguageSwitcher signedIn={false} className="border-white/20 bg-white/10 text-white" />
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.push('/login');
              }}
              className="cursor-pointer whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 sm:text-sm"
            >
              {t('logout')}
            </button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
