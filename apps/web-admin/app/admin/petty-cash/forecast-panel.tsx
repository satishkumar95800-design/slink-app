'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatMonthYear, formatRupees } from '../../../lib/format';
import { useLanguage } from '../../../lib/i18n/provider';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import type { Advice, Finding, Forecast } from './types';

/** Forecast and savings advice. Rules compute every number; the AI button only rephrases them. */
export function ForecastPanel({ version, aiInsights }: { version: number; aiInsights: boolean }) {
  const t = useTranslations('pettyCash');
  const errorText = useErrorText();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [failed, setFailed] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    api
      .get<Forecast>('/petty-cash/forecast')
      .then((f) => {
        setForecast(f);
        setFailed(false);
        setAdvice(null);
      })
      .catch(() => setFailed(true));
  }, [version]);

  async function askAdvice() {
    setAsking(true);
    try {
      setAdvice(await api.post<Advice>('/petty-cash/forecast/advice', {}));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setAsking(false);
    }
  }

  function findingText(f: Finding): string {
    const p = f.params;
    const money = (k: string) => formatRupees(Number(p[k]));
    const base = { category: f.subject.name ?? '', name: f.subject.name ?? '' };
    switch (f.kind) {
      case 'CATEGORY_TRENDING_UP':
        return t('finding.CATEGORY_TRENDING_UP', { ...base, recentAvg: money('recentAvg'), earlierAvg: money('earlierAvg'), growthPct: Number(p.growthPct) });
      case 'OUTLIER_ENTRY':
        return t('finding.OUTLIER_ENTRY', { ...base, amount: money('amount'), median: money('median'), multiple: Number(p.multiple), date: String(p.date) });
      case 'REPEATED_SMALL_PURCHASES':
        return t('finding.REPEATED_SMALL_PURCHASES', { ...base, countPerMonth: Number(p.countPerMonth), avgSize: money('avgSize'), totalPerMonth: money('totalPerMonth') });
      case 'LATE_SETTLEMENT':
        return t('finding.LATE_SETTLEMENT', { ...base, lateCount: Number(p.lateCount), total: Number(p.total), days: Number(p.days), avgDelay: Number(p.avgDelay) });
      case 'OVER_BUDGET_CATEGORY':
      case 'OVER_BUDGET_TOTAL':
        return t(`finding.${f.kind}`, { ...base, spend: money('spend'), budget: money('budget'), period: t(`period.${String(p.period) === 'last' ? 'last' : 'current'}`) });
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{t('forecastTitle')}</h2>
      {failed ? (
        <p className="mt-2 text-sm text-gray-500">{t('forecastUnavailable')}</p>
      ) : !forecast ? (
        <Spinner className="mt-4 h-6 w-6 text-teal" />
      ) : !forecast.ready ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-gray-600">{t('forecastNeedsHistory', { needed: forecast.needed, months: forecast.monthsOfData })}</p>
          <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-coral" style={{ width: `${Math.min(100, (forecast.monthsOfData / forecast.needed) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-cream p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('expectedSpend', { month: formatMonthYear(forecast.forecastMonth, language) })}
              </p>
              <p className="mt-1 text-xl font-extrabold text-gray-900">{formatRupees(forecast.total.expected)}</p>
              <p className="text-xs text-gray-500">{t('likelyRange', { low: formatRupees(forecast.total.low), high: formatRupees(forecast.total.high) })}</p>
            </div>
            <div className="rounded-2xl bg-cream p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('suggestedTopUp')}</p>
              <p className="mt-1 text-xl font-extrabold text-gray-900">{formatRupees(forecast.suggestedTopUp.expected)}</p>
              <p className="text-xs text-gray-500">{t('suggestedTopUpSafe', { high: formatRupees(forecast.suggestedTopUp.high), balance: formatRupees(forecast.currentBalance) })}</p>
            </div>
            <div className="rounded-2xl bg-cream p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t('historyTitle')}</p>
              <div className="mt-2 flex h-14 items-end gap-1" aria-hidden="true">
                {(() => {
                  const max = Math.max(1, ...forecast.history.map((h) => h.amount));
                  return forecast.history.map((h) => (
                    <div key={h.month} className="flex-1 rounded-t bg-teal/70" style={{ height: `${Math.max(4, (h.amount / max) * 100)}%` }} title={`${formatMonthYear(h.month, language)}: ${formatRupees(h.amount)}`} />
                  ));
                })()}
              </div>
              {forecast.seasonality.applied && forecast.seasonality.factor && (
                <p className="mt-1 text-xs text-gray-500">{t('seasonalityNote', { factor: forecast.seasonality.factor })}</p>
              )}
            </div>
          </div>

          {forecast.categories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('forecastByCategory')}</h3>
              <ul className="mt-2 divide-y divide-gray-100">
                {forecast.categories.map((c) => (
                  <li key={c.categoryId ?? 'none'} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="text-gray-900">{c.name ?? t('uncategorised')}</span>
                    <span className="text-gray-700">
                      {formatRupees(c.expected)} <span className="text-xs text-gray-500">({formatRupees(c.low)} – {formatRupees(c.high)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{t('savingsTitle')}</h3>
              {aiInsights && forecast.findings.length > 0 && (
                <Button size="sm" variant="secondary" loading={asking} onClick={askAdvice}>
                  {t('adviceButton')}
                </Button>
              )}
            </div>
            {forecast.findings.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">{t('noFindings')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {forecast.findings.map((f) => (
                  <li key={f.id} className={`rounded-xl p-3 text-sm ${f.severity === 'warning' ? 'bg-yellow-50 text-yellow-900' : 'bg-teal/5 text-gray-800'}`}>
                    {findingText(f)}
                  </li>
                ))}
              </ul>
            )}
            {advice?.ready && advice.text && (
              <div className="mt-3 rounded-xl border border-teal/20 bg-white p-4">
                <p className="whitespace-pre-line text-sm text-gray-800">{advice.text}</p>
                <p className="mt-2 text-xs text-gray-500">{advice.source === 'ai' ? t('adviceFromAi') : t('adviceFromRules')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
