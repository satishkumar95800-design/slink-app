'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { getSession } from '../../../lib/auth';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { EmptyState } from '../../../components/ui/empty-state';
import { Spinner } from '../../../components/ui/spinner';
import { AttendanceTab } from './attendance-tab';
import { EmployeesTab } from './employees-tab';
import { LeaveTab } from './leave-tab';
import { PayrollTab } from './payroll-tab';

type Tab = 'employees' | 'attendance' | 'leave' | 'payroll';

/** HR & Payroll: admin + accounts only, and only when the platform team switched `hrms` on. */
export default function HrPage() {
  const t = useTranslations('hr');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  }
  const role = getSession()?.role;
  if (role !== 'admin' && role !== 'accounts') return <EmptyState title={t('noAccess')} />;
  if (!features.hrms) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;
  return <Hr isAdmin={role === 'admin'} />;
}

function Hr({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('hr');
  const [tab, setTab] = useState<Tab>('employees');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'employees', label: t('tabEmployees') },
    { key: 'attendance', label: t('tabAttendance') },
    { key: 'leave', label: t('tabLeave') },
    { key: 'payroll', label: t('tabPayroll') },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              tab === x.key ? 'border-coral text-teal' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'payroll' && <PayrollTab isAdmin={isAdmin} />}
    </div>
  );
}
