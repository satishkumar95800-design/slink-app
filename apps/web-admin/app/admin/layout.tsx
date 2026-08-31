'use client';

import { useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '../../components/layout/sidebar';
import { isLoggedIn } from '../../lib/auth';
import { ToastProvider } from '../../components/ui/toast';

const ROUTE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/students': 'Students',
  '/admin/classes': 'Classes',
  '/admin/fees': 'Fee Structures',
  '/admin/student-fees': 'Student Fees',
  '/admin/payments': 'Payments',
  '/admin/reports': 'Reports',
  '/admin/import': 'Import Data',
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (!isLoggedIn()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
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
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
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
