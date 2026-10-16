'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { apiUpload, apiDownload, ApiError } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { useToast } from '../ui/toast';
import { StructuralErrorBanner, ValidationReportView, type ValidationReport } from './report-views';

interface PayeeSummary {
  groundStaff: { created: number; skipped: number };
  vendors: { created: number; skipped: number };
}

type Stage = 'idle' | 'validating' | 'validated' | 'committing' | 'done';

interface Props {
  /** The school's `pettyCash` flag. Off hides the section (the API also answers 403). */
  enabled: boolean;
  /** Show a hint instead of nothing when off (platform console, where the flag can be switched). */
  hintWhenOff?: boolean;
  tenantOverride?: string;
}

const TEMPLATE_FILE = 'vendors-and-ground-staff-template.xlsx';

/** True when the server actually answered, not a network failure. */
function isServerError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code !== 'NETWORK_ERROR';
}

/**
 * Separate import of vendors and ground staff into the Petty Cash payee list
 * (POST /imports/payees/validate | commit). Independent of the onboarding import above it.
 */
export function PayeeImportSection({ enabled, hintWhenOff, tenantOverride }: Props) {
  const t = useTranslations('import');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [summary, setSummary] = useState<PayeeSummary | null>(null);
  const [structuralError, setStructuralError] = useState<string | null>(null);

  if (!enabled) {
    return hintWhenOff ? (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
        <h2 className="text-base font-semibold text-gray-900">{t('payeeTitle')}</h2>
        <p className="mt-1">{t('payeeHintOff')}</p>
      </div>
    ) : null;
  }

  function reset() {
    setFile(null);
    setStage('idle');
    setReport(null);
    setSummary(null);
    setStructuralError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function fail(err: unknown) {
    toast(isServerError(err) ? err.message : t('unreachable'), 'error');
  }

  async function handleDownload() {
    try {
      await apiDownload('/imports/payees/template', TEMPLATE_FILE, tenantOverride);
    } catch {
      toast(t('templateFailed'), 'error');
    }
  }

  async function handleValidate() {
    if (!file) return;
    setStage('validating');
    setStructuralError(null);
    try {
      setReport(await apiUpload<ValidationReport>('/imports/payees/validate', file, undefined, tenantOverride));
      setStage('validated');
    } catch (err) {
      setStage('idle');
      if (isServerError(err)) setStructuralError(err.message);
      fail(err);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setStage('committing');
    try {
      const res = await apiUpload<{ summary: PayeeSummary }>('/imports/payees/commit', file, undefined, tenantOverride);
      setSummary(res.summary);
      setStage('done');
      toast(t('completed'), 'success');
    } catch (err) {
      setStage('validated');
      if (err instanceof ApiError && err.status === 422) {
        const fresh = (err.body as { error?: ValidationReport } | undefined)?.error;
        if (fresh?.tabs) setReport(fresh);
        toast(t('noLongerValid'), 'error');
      } else {
        fail(err);
      }
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="payee-import-title">
      <div className="flex items-start justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div>
          <h2 id="payee-import-title" className="text-base font-semibold text-gray-900">
            {t('payeeTitle')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{t('payeeIntro')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDownload}>
          {t('payeeDownloadTemplate')}
        </Button>
      </div>

      {structuralError && (stage === 'idle' || stage === 'validating') && (
        <StructuralErrorBanner message={structuralError} />
      )}

      {(stage === 'idle' || stage === 'validating') && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label htmlFor="payee-import-file" className="mb-2 block text-sm font-medium text-gray-700">
            {t('workbook')}
          </label>
          <input
            id="payee-import-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              setReport(null);
              setStructuralError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal hover:file:bg-teal/20"
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void handleValidate()} disabled={!file} loading={stage === 'validating'}>
              {t('validate')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'validated' && report && (
        <>
          <ValidationReportView report={report} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={reset}>
              {t('chooseDifferent')}
            </Button>
            <Button onClick={handleCommit} disabled={!report.canImport}>
              {t('import')}
            </Button>
          </div>
        </>
      )}

      {stage === 'committing' && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white p-10 text-sm text-gray-600 shadow-sm">
          <Spinner className="h-5 w-5 text-teal" />
          {t('writing')}
        </div>
      )}

      {stage === 'done' && summary && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">{t('success')}</div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 font-medium">{t('colEntity')}</th>
                  <th className="py-2 font-medium">{t('colCreated')}</th>
                  <th className="py-2 font-medium">{t('colSkipped')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { label: t('entityGroundStaff'), value: summary.groundStaff },
                  { label: t('entityVendors'), value: summary.vendors },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="py-2 text-gray-900">{row.label}</td>
                    <td className="py-2 text-gray-600">{row.value.created}</td>
                    <td className="py-2 text-gray-600">{row.value.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-500">{t('payeeSkippedNote')}</p>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={reset}>
              {t('startAnother')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
