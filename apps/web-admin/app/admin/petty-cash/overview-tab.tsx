'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import type { EntryModalRequest } from './entry-modal';
import { CashInHandCard } from './denominations';
import { ForecastPanel } from './forecast-panel';
import { Advance, STATUS_VARIANT, Statement, Summary } from './types';

interface Props {
  summary: Summary | null;
  version: number;
  aiInsights: boolean;
  onAction: (r: EntryModalRequest) => void;
  onGoToApprovals?: () => void;
}

function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function OverviewTab({ summary, version, aiInsights, onAction, onGoToApprovals }: Props) {
  const t = useTranslations('pettyCash');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [advances, setAdvances] = useState<Advance[] | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    api.get<Advance[]>('/petty-cash/advances?status=open').then(setAdvances).catch(() => setAdvances([]));
  }, [version]);

  async function openStatement(a: Advance) {
    if (!a.recipient) return;
    setLoadingStatement(true);
    try {
      const q = a.recipient.kind === 'user' ? `recipientUserId=${a.recipient.id}` : `payeeId=${a.recipient.id}`;
      setStatement(await api.get<Statement>(`/petty-cash/statement?${q}`));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setLoadingStatement(false);
    }
  }

  if (!summary)
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const m = summary.monthToDate;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('balance')} value={formatRupees(summary.balance)} sub={t('balanceHelp')} />
        <Stat
          label={t('monthSpend')}
          value={formatRupees(m.spend)}
          tone={m.overBudget ? 'bad' : 'default'}
          sub={m.budget ? t('ofBudget', { budget: formatRupees(m.budget), percent: m.usedPercent ?? 0 }) : t('noBudget')}
        />
        <Stat
          label={t('openAdvances')}
          value={String(summary.openAdvances.count)}
          sub={t('outstandingAmount', { amount: formatRupees(summary.openAdvances.outstanding) })}
        />
        <Stat
          label={t('overdueAdvances')}
          value={String(summary.overdueAdvances.count)}
          tone={summary.overdueAdvances.count > 0 ? 'bad' : 'default'}
          sub={t('outstandingAmount', { amount: formatRupees(summary.overdueAdvances.outstanding) })}
        />
      </div>

      {onGoToApprovals && summary.pendingApprovals.count > 0 && (
        <button
          onClick={onGoToApprovals}
          className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-left text-sm text-yellow-900"
        >
          <span>{t('pendingBanner', { count: summary.pendingApprovals.count, total: formatRupees(summary.pendingApprovals.total) })}</span>
          <span className="font-bold">{t('reviewNow')}</span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onAction({ type: 'TOP_UP' })}>
          {t('actionTopUp')}
        </Button>
        <Button size="sm" onClick={() => onAction({ type: 'DISBURSEMENT' })}>
          {t('actionDisburse')}
        </Button>
        <Button size="sm" onClick={() => onAction({ type: 'EXPENSE' })}>
          {t('actionExpense')}
        </Button>
      </div>

      <CashInHandCard version={version} />

      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">{t('openAdvancesTitle')}</h2>
        {!advances ? (
          <Spinner className="mt-4 h-6 w-6 text-teal" />
        ) : advances.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('noOpenAdvances')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {[t('colPerson'), t('colDate'), t('colGiven'), t('colSettled'), t('colOutstanding'), t('colAge'), ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-sm">
                      <p className="font-medium text-gray-900">{a.recipient?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{a.description}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-sm">{formatDateOnly(a.date)}</td>
                    <td className="px-3 py-2 text-sm">{formatRupees(a.amount)}</td>
                    <td className="px-3 py-2 text-sm">{formatRupees(a.settled)}</td>
                    <td className="px-3 py-2 text-sm font-semibold">{formatRupees(a.outstanding)}</td>
                    <td className="px-3 py-2 text-sm">
                      {a.ageDays} {a.overdue && <Badge variant="red">{t('overdueBadge')}</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onAction({ type: 'EXPENSE', advanceId: a.id })}>
                        {t('actionExpense')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onAction({ type: 'RETURN', advanceId: a.id })}>
                        {t('actionReturn')}
                      </Button>
                      <Button variant="ghost" size="sm" loading={loadingStatement} onClick={() => openStatement(a)}>
                        {t('statement')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {summary.byCategory.length > 0 && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{t('categoriesThisMonth')}</h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {summary.byCategory.map((c) => (
              <li key={c.categoryId} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-gray-900">{c.name}</span>
                <span className={c.overBudget ? 'font-semibold text-red-600' : 'text-gray-700'}>
                  {formatRupees(c.spend)}
                  {c.budget && <span className="text-gray-500"> / {formatRupees(c.budget)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ForecastPanel version={version} aiInsights={aiInsights} />

      <Modal open={!!statement} onClose={() => setStatement(null)} title={statement ? t('statementTitle', { name: statement.recipient.name }) : ''} size="xl">
        {statement && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={t('stmtDisbursed')} value={formatRupees(statement.totals.disbursed)} />
              <Stat label={t('stmtSettled')} value={formatRupees(statement.totals.settled)} />
              <Stat label={t('stmtOutstanding')} value={formatRupees(statement.totals.outstanding)} />
              <Stat label={t('stmtOverdue')} value={formatRupees(statement.totals.overdueOutstanding)} tone={statement.totals.overdueCount > 0 ? 'bad' : 'default'} />
            </div>
            {statement.advances.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noAdvances')}</p>
            ) : (
              <ul className="space-y-3">
                {statement.advances.map((a) => (
                  <li key={a.id} className="rounded-xl border border-gray-100 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-gray-900">
                        {formatDateOnly(a.date)} · {formatRupees(a.amount)} · {a.description}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[a.status]}>{t(`status.${a.status}`)}</Badge>
                        {a.overdue && <Badge variant="red">{t('overdueBadge')}</Badge>}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {t('stmtLine', { settled: formatRupees(a.settled), outstanding: formatRupees(a.outstanding) })}
                    </p>
                    {a.settlements.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600">
                        {a.settlements.map((s) => (
                          <li key={s.id}>
                            {formatDateOnly(s.date)} · {t(`type.${s.type}`)} · {formatRupees(s.amount)} · {t(`status.${s.status}`)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
