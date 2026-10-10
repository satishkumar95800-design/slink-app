'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession, isLoggedIn, clearSession } from '../../lib/auth';
import { ToastProvider } from '../../components/ui/toast';
import { ChangePasswordModal } from '../../components/layout/change-password-modal';
import { strings } from '../../lib/strings';
import { ConsoleI18nProvider } from '../../lib/i18n/provider';

/** The platform (super-admin) console stays English for now (docs/SPEC-languages.md scope);
 * the provider is here for the shared modal / spinner / password dialog. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleI18nProvider>
      <PlatformShell>{children}</PlatformShell>
    </ConsoleI18nProvider>
  );
}

function PlatformShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    const session = getSession();
    if (session?.role !== 'super_admin') {
      // Not a platform operator — this console isn't for them.
      router.replace('/admin');
      return;
    }
    setUserName(session.name);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
      </div>
    );
  }

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-cream">
        <header className="flex h-16 flex-shrink-0 items-center justify-between gap-2 border-b bg-teal px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-6">
            <Link href="/platform/tenants" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-coral/20 text-sm font-bold text-white/80">
                S
              </div>
              <span className="hidden text-sm font-bold tracking-tight text-white sm:inline">{strings.product.platformTitle}</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/platform/tenants"
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith('/platform/tenants')
                    ? 'bg-coral text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                Tenants
              </Link>
              <Link
                href="/platform/leads"
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith('/platform/leads')
                    ? 'bg-coral text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                Leads
              </Link>
            </nav>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-white/60">Super Admin</p>
            </div>
            <button
              onClick={() => setShowChangePassword(true)}
              className="whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              Change Password
            </button>
            <button
              onClick={handleLogout}
              className="whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium sm:px-3 sm:text-sm text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
        <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
      </div>
    </ToastProvider>
  );
}
