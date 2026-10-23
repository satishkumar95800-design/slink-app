'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { api } from '../../../../../lib/api-client';
import { formatDateOnly, formatDateTime, formatRupees } from '../../../../../lib/format';
import { useErrorText } from '../../../../../lib/i18n/errors';
import { Button } from '../../../../../components/ui/button';
import { Spinner } from '../../../../../components/ui/spinner';
import type { Receipt } from '../../types';

/** A desk receipt laid out for printing (A5-friendly). */
export default function DeskReceiptPage() {
  const t = useTranslations('reception');
  const errorText = useErrorText();
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Receipt>(`/reception/payments/${id}`)
      .then(setR)
      .catch((e) => setError(errorText(e)));
  }, [id, errorText]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!r)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );

  const rows: [string, string][] = [
    [t('child'), r.enquiry.childName],
    [t('parent'), `${r.enquiry.parentName} · ${r.enquiry.phone}`],
    ...(r.enquiry.classSought ? ([[t('classSought'), r.enquiry.classSought]] as [string, string][]) : []),
    [t('purpose'), t(`purposes.${r.purpose}`)],
    [t('mode'), t(`modes.${r.mode}`) + (r.reference ? ` · ${r.reference}` : '')],
    [t('receivedBy'), r.receivedBy],
  ];

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> {t('print')}
        </Button>
      </div>
      <article className="relative rounded-2xl border border-gray-200 bg-white p-8 print:border-0 print:p-0">
        {r.void && (
          <p className="absolute right-6 top-6 rotate-6 rounded-lg border-2 border-red-600 px-3 py-1 text-lg font-extrabold uppercase text-red-600">
            {t('voidStamp')}
          </p>
        )}
        <header className="border-b border-gray-200 pb-4 text-center">
          <h1 className="text-xl font-extrabold text-gray-900">{r.school.name}</h1>
          {r.school.address && <p className="text-sm text-gray-600">{r.school.address}</p>}
          {r.school.phone && <p className="text-sm text-gray-600">{r.school.phone}</p>}
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-gray-500">{t('receiptTitle')}</p>
        </header>
        <div className="mt-4 flex justify-between text-sm">
          <span className="font-semibold text-gray-900">{t('receiptNo', { no: r.receiptNo })}</span>
          <span className="text-gray-600">{formatDateOnly(r.receivedOn)}</span>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-gray-500">{k}</dt>
              <dd className="text-right text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="font-bold text-gray-900">{t('amountReceived')}</span>
          <span className="text-xl font-extrabold text-gray-900">{formatRupees(r.amount)}</span>
        </div>
        {r.void && (
          <p className="mt-4 text-sm text-red-600">
            {t('voidedOn', { date: formatDateTime(r.void.at), name: r.void.by, reason: r.void.reason ?? '' })}
          </p>
        )}
        <p className="mt-10 text-right text-xs text-gray-500">{t('signature')}</p>
      </article>
    </div>
  );
}
