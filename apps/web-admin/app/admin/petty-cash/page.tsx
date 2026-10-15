'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { EmptyState } from '../../../components/ui/empty-state';
import { Spinner } from '../../../components/ui/spinner';
import { ApprovalsTab } from './approvals-tab';
import { CategoriesTab } from './categories-tab';
import { EntryModal, EntryModalRequest } from './entry-modal';
import { LedgerTab } from './ledger-tab';
import { OverviewTab } from './overview-tab';
import { PayeesTab } from './payees-tab';
import { SettingsTab } from './settings-tab';
import type { Summary } from './types';
import { usePettyLookups } from './use-lookups';

type Tab = 'overview' | 'ledger' | 'approvals' | 'categories' | 'payees' | 'settings';

/** Petty cash: admin + accounts only, and only when the platform team switched the module on. */
export default function PettyCashPage() {
  const t = useTranslations('pettyCash');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  }
  // Read after the features have loaded, so server and first client render both show the spinner.
  const role = getSession()?.role;
  if (role !== 'admin' && role !== 'accounts') return <EmptyState title={t('noAccess')} />;
  if (!features.pettyCash) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;

  return <PettyCash isAdmin={role === 'admin'} aiInsights={!!features.aiInsights} />;
}

function PettyCash({ isAdmin, aiInsights }: { isAdmin: boolean; aiInsights: boolean }) {
  const t = useTranslations('pettyCash');
  const lookups = usePettyLookups();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [disabled, setDisabled] = useState(false);
  /** Bumped after every change so lists and the dashboard refetch. */
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState<EntryModalRequest | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    api
      .get<Summary>('/petty-cash/summary')
      .then(setSummary)
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'FEATURE_DISABLED') setDisabled(true);
      });
  }, [version]);

  if (disabled) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;

  const pending = summary?.pendingApprovals.count ?? 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('tabOverview') },
    { key: 'ledger', label: t('tabLedger') },
    ...(isAdmin ? [{ key: 'approvals' as Tab, label: pending > 0 ? t('tabApprovalsCount', { count: pending }) : t('tabApprovals') }] : []),
    { key: 'categories', label: t('tabCategories') },
    { key: 'payees', label: t('tabPayees') },
    { key: 'settings', label: t('tabSettings') },
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

      {tab === 'overview' && (
        <OverviewTab summary={summary} version={version} aiInsights={aiInsights} onAction={setModal} onGoToApprovals={isAdmin ? () => setTab('approvals') : undefined} />
      )}
      {tab === 'ledger' && <LedgerTab lookups={lookups} version={version} onAction={setModal} onChanged={refresh} />}
      {tab === 'approvals' && isAdmin && <ApprovalsTab version={version} onChanged={refresh} />}
      {tab === 'categories' && (
        <CategoriesTab
          categories={lookups.categories}
          onChanged={() => {
            lookups.reload();
            refresh();
          }}
        />
      )}
      {tab === 'payees' && <PayeesTab payees={lookups.payees} onChanged={lookups.reload} />}
      {tab === 'settings' && <SettingsTab isAdmin={isAdmin} onChanged={refresh} />}

      {modal && (
        <EntryModal
          request={modal}
          lookups={lookups}
          settings={summary?.settings ?? null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
