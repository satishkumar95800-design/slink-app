'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, apiDownload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatMonthYear, formatRupees } from '../../../lib/format';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';

/** One locked month's payslip (GET /hrms/me/payslips). */
interface Payslip {
  id: string;
  month: string;
  gross: string;
  deductions: string;
  net: string;
  paidAt: string | null;
}

/** Why payslips can't be shown: the HR module is off, or this login has no employee record. */
type Unavailable = 'off' | 'noRecord' | 'failed' | null;

/** The signed-in teacher's own payslips, one per locked pay run, each downloadable as a PDF. */
export default function PayslipsPage() {
  const t = useTranslations('payslips');
  const locale = useLocale();
  const errorText = useErrorText();
  const { toast } = useToast();
  const { features, loaded } = useTenantFeaturesState();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [error, setError] = useState<Unavailable>(null);
  const [fetched, setFetched] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded || !features.hrms) return;
    api.get<Payslip[]>('/hrms/me/payslips').then(
      (rows) => {
        setPayslips(rows);
        setFetched(true);
      },
      (e: unknown) => {
        const code = (e as { code?: string })?.code;
        setError(code === 'NO_EMPLOYEE_RECORD' ? 'noRecord' : code === 'FEATURE_DISABLED' ? 'off' : 'failed');
        setFetched(true);
      },
    );
  }, [loaded, features.hrms]);

  const unavailable: Unavailable = loaded && !features.hrms ? 'off' : error;
  const loading = !unavailable && !fetched;

  async function download(p: Payslip) {
    setDownloadingId(p.id);
    try {
      await apiDownload(`/hrms/me/payslips/${p.id}/pdf`, `payslip-${p.month}.pdf`);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('intro')}</p>
      </div>
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : unavailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unavailable === 'noRecord' ? t('noRecord') : unavailable === 'failed' ? t('loadFailed') : t('off')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {payslips.length === 0 ? (
            <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cream/60">
                  <tr>
                    {[t('colMonth'), t('colGross'), t('colDeductions'), t('colNet'), t('colStatus'), ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {formatMonthYear(p.month, locale)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{formatRupees(p.gross)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{formatRupees(p.deductions)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">{formatRupees(p.net)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {p.paidAt ? (
                          <Badge variant="green">{t('paidOn', { date: formatDateOnly(p.paidAt) })}</Badge>
                        ) : (
                          <Badge variant="yellow">{t('unpaid')}</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button size="sm" variant="secondary" loading={downloadingId === p.id} onClick={() => download(p)}>
                          <Download className="h-4 w-4" />
                          {t('download')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
