'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession, isLoggedIn, clearSession } from '../../lib/auth';
import { ToastProvider } from '../../components/ui/toast';

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <ToastProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-slate-900 px-6">
          <div className="flex items-center gap-6">
            <Link href="/platform/tenants" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/20 text-sm font-bold text-blue-200">
                S
              </div>
              <span className="text-sm font-bold tracking-tight text-white">School Connect — Platform</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/platform/tenants"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  pathname.startsWith('/platform/tenants')
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Tenants
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-xs text-slate-400">Super Admin</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}
