'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession } from '../../lib/auth';
import { useTranslations } from 'next-intl';
import { strings } from '../../lib/strings';
import { LanguageSwitcher } from './language-switcher';

interface NavItem {
  /** Key into messages "nav". */
  label: 'dashboard' | 'users' | 'students' | 'classes' | 'teachers' | 'fees' | 'studentFees' | 'payments' | 'feeReports' | 'reports' | 'attendance' | 'documents' | 'timetable' | 'paymentClaims' | 'import' | 'settings';
  href: string;
  icon: string;
  /** Roles that should not see this item in the sidebar (still reachable by direct URL if the API allows it). */
  hiddenForRoles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'dashboard', href: '/admin', icon: '◼' },
  { label: 'users', href: '/admin/users', icon: '👤', hiddenForRoles: ['teacher'] },
  { label: 'students', href: '/admin/students', icon: '🎓' },
  { label: 'classes', href: '/admin/classes', icon: '🏫' },
  { label: 'teachers', href: '/admin/teachers', icon: '🧑‍🏫', hiddenForRoles: ['teacher'] },
  { label: 'fees', href: '/admin/fees', icon: '📋', hiddenForRoles: ['teacher'] },
  { label: 'studentFees', href: '/admin/student-fees', icon: '💰', hiddenForRoles: ['teacher'] },
  { label: 'payments', href: '/admin/payments', icon: '💳', hiddenForRoles: ['teacher'] },
  { label: 'feeReports', href: '/admin/fee-reports', icon: '📈', hiddenForRoles: ['teacher'] },
  { label: 'reports', href: '/admin/reports', icon: '📊' },
  { label: 'attendance', href: '/admin/attendance', icon: '✅', hiddenForRoles: ['teacher', 'accounts'] },
  { label: 'documents', href: '/admin/documents', icon: '🗂️', hiddenForRoles: ['teacher'] },
  { label: 'timetable', href: '/admin/timetable', icon: '🗓️', hiddenForRoles: ['teacher'] },
  { label: 'paymentClaims', href: '/admin/payment-claims', icon: '🧾', hiddenForRoles: ['teacher'] },
  { label: 'import', href: '/admin/import', icon: '📥', hiddenForRoles: ['teacher'] },
  { label: 'settings', href: '/admin/settings', icon: '⚙️', hiddenForRoles: ['teacher'] },
];

interface SidebarProps {
  tenant?: { name: string; logoUrl: string | null } | null;
  /** Mobile/tablet drawer state — the sidebar is always visible at lg and up. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ tenant, open = false, onClose }: SidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const role = getSession()?.role;
  const items = NAV_ITEMS.filter((item) => !role || !item.hiddenForRoles?.includes(role));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-60 flex-shrink-0 flex-col bg-teal text-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-md object-cover ring-1 ring-white/20" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-coral/20 text-sm font-bold text-white/80">
            S
          </div>
        )}
        <span className="truncate text-sm font-bold text-white tracking-tight">{tenant?.name ?? strings.product.name}</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-coral text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {t(item.label)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-4 sm:hidden">
        <LanguageSwitcher signedIn />
      </div>
    </aside>
    </>
  );
}
