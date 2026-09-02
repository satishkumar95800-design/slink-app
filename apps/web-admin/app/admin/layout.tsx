'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../../components/layout/sidebar';
import { isLoggedIn } from '../../lib/auth';
import { ToastProvider } from '../../components/ui/toast';
import { api } from '../../lib/api-client';

interface TenantBrand {
  id: string;
  name: string;
  logoUrl: string | null;
}

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/students': 'Students',
  '/admin/classes': 'Classes',
  '/admin/fees': 'Fee Structures',
  '/admin/student-fees': 'Student Fees',
  '/admin/payments': 'Payments',
  '/admin/fee-reports': 'Fee Reports',
  '/admin/reports': 'Reports',
  '/admin/import': 'Import Data',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const title = ROUTE_TITLES[pathname] ?? 'Admin';

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar tenant={tenant} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
            <div className="flex items-center gap-3">
              {tenant?.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-md object-cover ring-1 ring-gray-200" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-sm font-bold text-blue-700">
                  S
                </div>
              )}
              <h1 className="text-lg font-semibold text-gray-900">{tenant?.name ?? title}</h1>
            </div>
            <LogoutButton />
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function LogoutButton() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

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
    localStorage.clear();
    document.cookie = 'slink_authed=; path=/; max-age=0';
    router.push('/login');
  }

  return (
    <div className="flex items-center gap-4">
      {user && (
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
        </div>
      )}
      <button
        onClick={handleLogout}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Logout
      </button>
    </div>
  );
}
