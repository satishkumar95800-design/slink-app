'use client';

import { AlertTriangle, Eye, Mail, Sparkles, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { formatDateTime, formatRupees } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Spinner } from '../../../components/ui/spinner';
import type { Band, Finding, Insights } from '../types';

const BAND_TONE: Record<Band, { bar: string; chip: string }> = {
  good: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800' },
  watch: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-900' },
  risk: { bar: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
};
const SEVERITY_ICON = { risk: AlertTriangle, watch: Eye, good: ThumbsUp } as const;
/** Values that are rupee amounts in each finding (the rest are counts or percents). */
const MONEY = new Set(['outstanding', 'amount', 'now', 'before']);
const MONEY_KINDS = new Set(['collection_behind', 'group_dues', 'collections_slowing']);

/** Head office insights: branch health, what needs attention, and the weekly AI brief. */
export default function HeadOfficeInsights() {
  const t = useTranslations('headOffice.insights');
  const errorText = useErrorText();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api
        .get<Insights>('/head-office/insights')
        .then(setData)
        .catch((e) => setError(errorText(e))),
    [errorText],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function writeBrief() {
    setWriting(true);
    setBriefError(null);
    try {
      const brief = await api.post<{ text: string; createdAt: string }>('/head-office/insights/brief', {});
      setData((d) => (d ? { ...d, brief } : d));
    } catch (e) {
      setBriefError(errorText(e));
    } finally {
      setWriting(false);
    }
  }

  if (error) return <div className="mx-auto max-w-6xl rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!data)
    return (
      <div className="flex justify-center p-16">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  if (!data.group) return <EmptyState title={t('title')} description={t('findingsNone')} />;

  const sentence = (f: Finding) => {
    const values: Record<string, string | number> = { branch: f.branch ?? '' };
    for (const [k, v] of Object.entries(f.values))
      values[k] = MONEY_KINDS.has(f.kind) && MONEY.has(k) ? formatRupees(v) : v;
    return t(`finding.${f.kind}`, values);
  };
  const part = (v: number | null) => (v === null ? '—' : String(v));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </div>

      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-coral/10 text-coral">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-gray-900">{t('briefTitle')}</h2>
          </div>
          {data.aiAvailable && data.findings.length > 0 && (
            <Button size="sm" variant={data.brief ? 'secondary' : 'primary'} loading={writing} onClick={writeBrief}>
              {writing ? t('briefWriting') : data.brief ? t('briefRewrite') : t('briefWrite')}
            </Button>
          )}
        </div>
        {data.brief ? (
          <>
            <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-800">{data.brief.text}</div>
            <p className="mt-2 text-xs text-gray-500">{t('briefWritten', { date: formatDateTime(data.brief.createdAt) })}</p>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-500">{data.aiAvailable ? t('briefNone') : t('briefAiOff')}</p>
        )}
        {briefError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{briefError}</p>}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
          <Mail className="h-3.5 w-3.5" />
          {t('briefEmail')}
        </p>
      </section>

      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">{t('findingsTitle')}</h2>
        {data.findings.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('findingsNone')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.findings.map((f, i) => {
              const Icon = SEVERITY_ICON[f.severity];
              return (
                <li key={`${f.kind}-${f.branchId ?? 'group'}-${i}`} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${BAND_TONE[f.severity].chip}`}>
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{t(`severity.${f.severity}`)}</p>
                    <p className="mt-0.5">
                      {f.branchId ? (
                        <Link href={`/head-office/branches/${f.branchId}`} className="hover:underline">
                          {sentence(f)}
                        </Link>
                      ) : (
                        sentence(f)
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-black/5 bg-white shadow-sm">
        <div className="px-5 pt-5">
          <h2 className="text-base font-semibold text-gray-900">{t('scoresTitle')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('scoresHelp')}</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-cream/60">
              <tr>
                {(['colRank', 'colBranch', 'colScore', 'colAttendance', 'colCollection', 'colAppUse', 'colSyllabus', 'colCompliance'] as const).map((c) => (
                  <th key={c} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.scores.map((s, i) => (
                <tr key={s.id}>
                  <td className="px-3 py-3 text-gray-500">{s.score === null ? '—' : i + 1}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-900">
                    <Link href={`/head-office/branches/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="min-w-[11rem] px-3 py-3">
                    {s.score === null || !s.band ? (
                      <span className="text-xs text-gray-500">{t('noScore')}</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-right font-bold text-gray-900">{s.score}</span>
                        <span className="h-2 w-20 overflow-hidden rounded-full bg-gray-100">
                          <span className={`block h-full ${BAND_TONE[s.band].bar}`} style={{ width: `${s.score}%` }} />
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_TONE[s.band].chip}`}>{t(`band.${s.band}`)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{part(s.parts.attendance)}</td>
                  <td className="px-3 py-3 text-gray-700">{part(s.parts.collection)}</td>
                  <td className="px-3 py-3 text-gray-700">{part(s.parts.appUse)}</td>
                  <td className="px-3 py-3 text-gray-700">{part(s.parts.syllabus)}</td>
                  <td className="px-3 py-3 text-gray-700">{part(s.parts.compliance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
