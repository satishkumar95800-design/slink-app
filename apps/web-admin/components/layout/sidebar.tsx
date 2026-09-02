'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: '◼' },
  { label: 'Users', href: '/admin/users', icon: '👤' },
  { label: 'Students', href: '/admin/students', icon: '🎓' },
  { label: 'Classes', href: '/admin/classes', icon: '🏫' },
  { label: 'Fee Structures', href: '/admin/fees', icon: '📋' },
  { label: 'Student Fees', href: '/admin/student-fees', icon: '💰' },
  { label: 'Payments', href: '/admin/payments', icon: '💳' },
  { label: 'Fee Reports', href: '/admin/fee-reports', icon: '📈' },
  { label: 'Reports', href: '/admin/reports', icon: '📊' },
  { label: 'Import Data', href: '/admin/import', icon: '📥' },
];

interface SidebarProps {
  tenant?: { name: string; logoUrl: string | null } | null;
}

export function Sidebar({ tenant }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="flex h-16 items-center gap-3 border-b border-slate-700 px-4">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8 w-8 rounded-md object-cover ring-1 ring-slate-700" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/20 text-sm font-bold text-blue-200">
            S
          </div>
        )}
        <span className="truncate text-sm font-bold text-white tracking-tight">{tenant?.name ?? 'School Connect'}</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
