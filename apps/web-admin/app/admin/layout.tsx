'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../../components/layout/sidebar';
import { ChangePasswordModal } from '../../components/layout/change-password-modal';
import { isLoggedIn } from '../../lib/auth';
import { ToastProvider } from '../../components/ui/toast';
import { api } from '../../lib/api-client';
import { useTranslations } from 'next-intl';
import { ConsoleI18nProvider } from '../../lib/i18n/provider';
import { LanguageSwitcher } from '../../components/layout/language-switcher';

interface TenantBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
}

/** Header title (shown when the school's name hasn't loaded) — keys into messages "nav". */
const ROUTE_TITLES = {
  '/admin': 'dashboard',
  '/admin/users': 'users',
  '/admin/students': 'students',
  '/admin/classes': 'classes',
  '/admin/fees': 'fees',
  '/admin/student-fees': 'studentFees',
  '/admin/payments': 'payments',
  '/admin/fee-reports': 'feeReports',
  '/admin/reports': 'reports',
  '/admin/import': 'import',
  '/admin/settings': 'settings',
} as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleI18nProvider>
      <AdminShell>{children}</AdminShell>
    </ConsoleI18nProvider>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [tenant, setTenant] = useState<TenantBrand | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }

    api.get<TenantBrand>('/tenant')
      .then(setTenant)
      .catch(() => setTenant(null));
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
      </div>
    );
  }

  const titleKey = ROUTE_TITLES[pathname as keyof typeof ROUTE_TITLES];
  const title = titleKey ? t(titleKey) : t('admin');

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-cream">
        <Sidebar tenant={tenant} open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b border-black/5 bg-cream/90 backdrop-blur px-3 shadow-sm sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="-ml-1 rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
                aria-label={t('openMenu')}
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 100 2h12a1 1 0 100-2H4z" clipRule="evenodd" />
                </svg>
              </button>
              {tenant?.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-md object-cover ring-1 ring-gray-100" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal/10 text-sm font-bold text-teal">
                  S
                </div>
              )}
              <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg">{tenant?.name ?? title}</h1>
            </div>
            <LogoutButton />
          </header>
          <main
            className="flex-1 overflow-y-auto bg-cover bg-center bg-fixed p-3 sm:p-4 lg:p-6"
            style={
              tenant?.backgroundImageUrl
                ? {
                    backgroundImage: `linear-gradient(rgba(251,243,234,.93), rgba(251,243,234,.93)), url(${tenant.backgroundImageUrl})`,
                  }
                : undefined
            }
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

function LogoutButton() {
  const t = useTranslations('header');
  const tRoles = useTranslations('roles');
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('slink_user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser({ name: u.name, role: u.role });
      } catch {}
    }
  }, []);

  function handleLogout() {
    // Keep the language: the login page should stay in the language they use.
    const language = localStorage.getItem('slink_language');
    localStorage.clear();
    if (language) localStorage.setItem('slink_language', language);
    document.cookie = 'slink_authed=; path=/; max-age=0';
    router.push('/login');
  }

  // Parents authenticate via phone OTP on mobile only — they never land on
  // this web console, so no role here needs to be excluded from this action.
  return (
    <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
      {user && (
        <div className="hidden text-right md:block">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{roleLabel(tRoles, user.role)}</p>
        </div>
      )}
      {/* Phones get the switcher in the slide-out menu instead — the header has no room. */}
      <span className="hidden sm:block">
        <LanguageSwitcher signedIn />
      </span>
      <button
        onClick={() => setShowChangePassword(true)}
        className="whitespace-nowrap rounded-full border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm text-gray-700 hover:bg-cream transition-colors cursor-pointer"
      >
        {t('changePassword')}
      </button>
      <button
        onClick={handleLogout}
        className="whitespace-nowrap rounded-full border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm text-gray-700 hover:bg-cream transition-colors cursor-pointer"
      >
        {t('logout')}
      </button>
      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </div>
  );
}

const ROLE_KEYS = ['parent', 'teacher', 'admin', 'accounts', 'super_admin'] as const;

function roleLabel(t: ReturnType<typeof useTranslations<'roles'>>, role: string) {
  return (ROLE_KEYS as readonly string[]).includes(role) ? t(role as (typeof ROLE_KEYS)[number]) : role;
}
