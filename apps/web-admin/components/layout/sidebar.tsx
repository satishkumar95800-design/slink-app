'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  ChartColumn,
  ChartLine,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  Folders,
  GraduationCap,
  LayoutDashboard,
  LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Briefcase,
  Presentation,
  Receipt,
  School,
  Settings,
  Upload,
  Users,
  Wallet,
  Bus,
  ListChecks,
  UserPlus,
  ConciergeBell,
  Library,
} from 'lucide-react';
import { getSession } from '../../lib/auth';
import { TenantFeatures, useTenantFeatures } from '../../lib/tenant-features';
import { useTranslations } from 'next-intl';
import { strings } from '../../lib/strings';
import { LanguageSwitcher } from './language-switcher';
import { isDeskRole } from '../../lib/roles';

interface NavItem {
  /** Key into messages "nav". */
  label: 'dashboard' | 'users' | 'students' | 'classes' | 'teachers' | 'fees' | 'studentFees' | 'payments' | 'feeReports' | 'reports' | 'attendance' | 'documents' | 'timetable' | 'paymentClaims' | 'pettyCash' | 'hr' | 'absence' | 'payslips' | 'sharedDocs' | 'syllabus' | 'admissions' | 'schoolBus' | 'reception' | 'library' | 'import' | 'settings';
  href: string;
  icon: LucideIcon;
  /** Roles that should not see this item in the sidebar (still reachable by direct URL if the API allows it). */
  hiddenForRoles?: string[];
  /** Only these roles see the item (still subject to the API's own checks). */
  onlyRoles?: string[];
  /** Optional per-school module that must be switched on (tenants.features). */
  feature?: keyof TenantFeatures;
}

interface NavGroup {
  /** Key into messages "nav"; no heading for the first group. */
  title?: 'groupAcademics' | 'groupFees' | 'groupOffice' | 'groupStaff' | 'groupSetup';
  /** Folded until opened: pages a school sets up once and rarely visits. */
  closedByDefault?: boolean;
  items: NavItem[];
}

/** Grouped by how often a school uses them; "Setup" starts folded. */
const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: 'dashboard', href: '/admin', icon: LayoutDashboard }] },
  {
    title: 'groupAcademics',
    items: [
      { label: 'students', href: '/admin/students', icon: GraduationCap },
      { label: 'attendance', href: '/admin/attendance', icon: CalendarCheck, hiddenForRoles: ['accounts'] },
      { label: 'absence', href: '/admin/absence', icon: CalendarX2, onlyRoles: ['teacher'] },
      { label: 'reports', href: '/admin/reports', icon: ChartColumn },
      { label: 'syllabus', href: '/admin/syllabus', icon: ListChecks, onlyRoles: ['admin', 'teacher'], feature: 'syllabus' },
    ],
  },
  {
    title: 'groupFees',
    items: [
      { label: 'studentFees', href: '/admin/student-fees', icon: Wallet, hiddenForRoles: ['teacher'] },
      { label: 'payments', href: '/admin/payments', icon: CreditCard, hiddenForRoles: ['teacher'] },
      { label: 'paymentClaims', href: '/admin/payment-claims', icon: Receipt, hiddenForRoles: ['teacher'] },
      { label: 'feeReports', href: '/admin/fee-reports', icon: ChartLine, hiddenForRoles: ['teacher'], feature: 'advancedReports' },
    ],
  },
  {
    title: 'groupOffice',
    items: [
      { label: 'reception', href: '/admin/reception', icon: ConciergeBell, onlyRoles: ['receptionist', 'admin', 'accounts'], feature: 'admissions' },
      { label: 'admissions', href: '/admin/admissions', icon: UserPlus, onlyRoles: ['admin', 'accounts', 'receptionist'], feature: 'admissions' },
      { label: 'schoolBus', href: '/admin/school-bus', icon: Bus, onlyRoles: ['admin', 'accounts'], feature: 'transport' },
      { label: 'library', href: '/admin/library', icon: Library, onlyRoles: ['librarian', 'admin'], feature: 'library' },
      { label: 'documents', href: '/admin/documents', icon: FolderOpen, hiddenForRoles: ['teacher'] },
      { label: 'sharedDocs', href: '/admin/shared-documents', icon: Folders, onlyRoles: ['teacher', 'admin', 'accounts'], feature: 'staffDocuments' },
    ],
  },
  {
    title: 'groupStaff',
    items: [
      { label: 'pettyCash', href: '/admin/petty-cash', icon: PiggyBank, onlyRoles: ['admin', 'accounts'], feature: 'pettyCash' },
      { label: 'hr', href: '/admin/hr', icon: Briefcase, onlyRoles: ['admin', 'accounts'], feature: 'hrms' },
      { label: 'payslips', href: '/admin/payslips', icon: FileText, onlyRoles: ['teacher'], feature: 'hrms' },
    ],
  },
  {
    title: 'groupSetup',
    closedByDefault: true,
    items: [
      { label: 'classes', href: '/admin/classes', icon: School },
      { label: 'teachers', href: '/admin/teachers', icon: Presentation, hiddenForRoles: ['teacher'] },
      { label: 'timetable', href: '/admin/timetable', icon: CalendarDays, hiddenForRoles: ['teacher'], feature: 'timetable' },
      { label: 'fees', href: '/admin/fees', icon: ClipboardList, hiddenForRoles: ['teacher'] },
      { label: 'users', href: '/admin/users', icon: Users, hiddenForRoles: ['teacher'] },
      { label: 'import', href: '/admin/import', icon: Upload, hiddenForRoles: ['teacher'] },
      { label: 'settings', href: '/admin/settings', icon: Settings, hiddenForRoles: ['teacher'] },
    ],
  },
];

const FOLD_KEY = 'nav.folded';

/** Groups this browser folded or opened; the defaults apply to the rest. */
function useFolded() {
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '{}') as unknown;
      if (saved && typeof saved === 'object') setFolded(saved as Record<string, boolean>);
    } catch {
      // Storage blocked: defaults.
    }
  }, []);
  const toggle = (title: string, fold: boolean) =>
    setFolded((prev) => {
      const next = { ...prev, [title]: fold };
      try {
        localStorage.setItem(FOLD_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, still toggles.
      }
      return next;
    });
  return { folded, toggle };
}

const isActive = (item: NavItem, pathname: string) => (item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href));

interface SidebarProps {
  tenant?: { name: string; logoUrl: string | null } | null;
  /** Mobile/tablet drawer state — the sidebar is always visible at lg and up. */
  open?: boolean;
  onClose?: () => void;
  /** lg and up: icons only. The phone drawer always shows labels. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ tenant, open = false, onClose, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const role = getSession()?.role;
  const features = useTenantFeatures();
  const { folded, toggle } = useFolded();
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        // Desk logins see only the pages that name them.
        (!isDeskRole(role) || !!item.onlyRoles?.includes(role!)) &&
        (!role || !item.hiddenForRoles?.includes(role)) &&
        (!item.onlyRoles || (!!role && item.onlyRoles.includes(role))) &&
        (!item.feature || features[item.feature] === true),
    ),
  })).filter((g) => g.items.length > 0);
  // Labels hide only on desktop when collapsed.
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : '';

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-teal/40 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-shrink-0 flex-col bg-teal text-white transition-[transform,width] duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-64'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className={`flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/10 px-4 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-9 flex-shrink-0 rounded-xl object-cover ring-1 ring-white/20" />
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white p-1.5">
              <img src="/schoolinkd-mark.svg" alt="" className="h-full w-full" />
            </div>
          )}
          <span className={`truncate text-sm font-bold tracking-tight text-white ${hideWhenCollapsed}`}>
            {tenant?.name ?? strings.product.name}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {groups.map((group, gi) => {
            // The group of the open page never folds.
            const holdsActive = group.items.some((item) => isActive(item, pathname));
            const isFolded = !!group.title && !holdsActive && (folded[group.title] ?? !!group.closedByDefault);
            const listId = `nav-${group.title ?? 'main'}`;
            return (
            <div key={group.title ?? 'main'} className={gi > 0 ? 'mt-4' : ''}>
              {group.title && (
                <>
                  <button
                    type="button"
                    onClick={() => toggle(group.title!, !isFolded)}
                    disabled={holdsActive}
                    aria-expanded={!isFolded}
                    aria-controls={listId}
                    className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40 transition-colors enabled:cursor-pointer enabled:hover:text-white/75 ${hideWhenCollapsed}`}
                  >
                    {t(group.title)}
                    {!holdsActive && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isFolded ? '-rotate-90' : ''}`} />}
                  </button>
                  {collapsed && <div className="mx-auto mb-2 hidden h-px w-8 bg-white/10 lg:block" />}
                </>
              )}
              {/* Icons only (collapsed on desktop) keeps every item. */}
              <ul id={listId} className={`space-y-0.5 ${isFolded ? (collapsed ? 'hidden lg:block' : 'hidden') : ''}`}>
                {group.items.map((item) => {
                  const active = isActive(item, pathname);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        title={collapsed ? t(item.label) : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                          collapsed ? 'lg:justify-center lg:px-0' : ''
                        } ${
                          active
                            ? 'bg-coral text-white shadow-md shadow-black/10'
                            : 'text-white/65 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={2.2} />
                        <span className={`truncate ${hideWhenCollapsed}`}>{t(item.label)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4 sm:hidden">
          <LanguageSwitcher signedIn />
        </div>
        {onToggleCollapsed && (
          <div className="hidden border-t border-white/10 p-3 lg:block">
            <button
              type="button"
              onClick={onToggleCollapsed}
              title={collapsed ? t('expand') : t('collapse')}
              aria-label={collapsed ? t('expand') : t('collapse')}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white ${
                collapsed ? 'justify-center px-0' : ''
              }`}
            >
              {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
              {!collapsed && <span>{t('collapse')}</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
