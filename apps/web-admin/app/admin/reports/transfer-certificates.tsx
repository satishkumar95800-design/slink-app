'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly } from '../../../lib/format';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';

interface ClassOption {
  id: string;
  name: string;
  section: string | null;
}

interface Row {
  id: string;
  name: string;
  admissionNo: string;
  tcUploadedAt: string | null;
  class: ClassOption | null;
}

interface Result {
  counts: { attached: number; missing: number };
  data: Row[];
  meta: { total: number };
}

const className = (c: ClassOption | null) => (c ? [c.name, c.section].filter(Boolean).join(' ') : '—');

/** "Which students have no TC on file?" — schools with features.transferCertificate only. */
export function TransferCertificateReport() {
  const t = useTranslations('transferCertificate');
  const errorText = useErrorText();
  const [status, setStatus] = useState<'missing' | 'attached'>('missing');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const query = new URLSearchParams({ status, limit: '500', ...(classId ? { classId } : {}) }).toString();
  // What the last response was for; anything else on screen is still loading.
  const [loaded, setLoaded] = useState<{ query: string; result: Result | null; error: string | null } | null>(null);
  const loading = loaded?.query !== query;
  const result = loading ? null : loaded.result;
  const error = loading ? null : loaded.error;

  useEffect(() => {
    api.get<ClassOption[]>('/classes').then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true; // ignore a slow reply after the filters changed again
    api
      .get<Result>(`/transfer-certificates?${query}`)
      .then((r) => live && setLoaded({ query, result: r, error: null }))
      .catch((e) => live && setLoaded({ query, result: null, error: errorText(e) }));
    return () => {
      live = false;
    };
  }, [query, errorText]);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{t('reportTitle')}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{t('reportHelp')}</p>
          {result && (
            <p className="mt-2 text-sm">
              <span className="font-semibold text-coral-dark">{t('missingCount', { count: result.counts.missing })}</span>
              <span className="mx-2 text-gray-300">{'|'}</span>
              <span className="text-gray-600">{t('attachedCount', { count: result.counts.attached })}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Select
            label={t('filterStatus')}
            value={status}
            onChange={(e) => setStatus(e.target.value as 'missing' | 'attached')}
            options={[
              { value: 'missing', label: t('filterMissing') },
              { value: 'attached', label: t('filterAttached') },
            ]}
          />
          <Select
            label={t('filterClass')}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            options={[
              { value: '', label: t('allClasses') },
              ...classes.map((c) => ({ value: c.id, label: className(c) })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <Spinner className="h-6 w-6 text-teal" />
        </div>
      ) : error ? (
        <p className="px-6 py-4 text-sm text-red-700">{error}</p>
      ) : !result || result.data.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="sticky top-0 bg-cream">
              <tr>
                {[t('colStudent'), t('colAdmissionNo'), t('colClass'), ...(status === 'attached' ? [t('colUploaded')] : [])].map(
                  (h) => (
                    <th key={h} className="px-6 py-2 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.data.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-2 text-sm">
                    <Link href={`/admin/students/${s.id}`} className="text-teal hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-6 py-2 font-mono text-sm text-gray-700">{s.admissionNo}</td>
                  <td className="px-6 py-2 text-sm text-gray-600">{className(s.class)}</td>
                  {status === 'attached' && (
                    <td className="px-6 py-2 text-sm text-gray-600">
                      {s.tcUploadedAt ? formatDateOnly(s.tcUploadedAt) : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
