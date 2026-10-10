'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { api, apiUpload, apiDownload, ApiError } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import { Badge } from '../ui/badge';
import { useToast } from '../ui/toast';

interface ImportIssue {
  tab: string;
  row: number;
  column?: string;
  reason: string;
}

interface TabReport {
  tab: string;
  rowCount: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

interface ValidationReport {
  tabs: TabReport[];
  totalErrors: number;
  totalWarnings: number;
  canImport: boolean;
}

interface EntitySummary {
  created: number;
  updated: number;
}

interface CreatedUserCredential {
  email: string;
  temporaryPassword: string;
}

interface ImportSummary {
  classes: EntitySummary;
  users: EntitySummary;
  students: EntitySummary;
  feeStructures: EntitySummary;
  teachers: EntitySummary;
  createdUserCredentials: CreatedUserCredential[];
}

interface CommitResult {
  importJobId: string;
  status: 'completed' | 'pending';
  summary?: ImportSummary;
}

interface ImportJobStatusResponse {
  id: string;
  status: string;
  fileName: string;
  summary: ImportSummary | null;
  errorReport: unknown;
}

type Stage = 'idle' | 'validating' | 'validated' | 'committing' | 'polling' | 'done';

const POLL_INTERVAL_MS = 2000;

interface ImportWorkflowProps {
  /** Tenant slug/id to import into. Omit to use the logged-in user's own tenant
   * (the admin console case) — pass it explicitly from the platform console, where
   * a super_admin is acting on a tenant other than the one they belong to. */
  tenantOverride?: string;
}

/** True when the server actually answered (a real problem with the file), not a network failure. */
function isServerError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code !== 'NETWORK_ERROR';
}

export function ImportWorkflow({ tenantOverride }: ImportWorkflowProps) {
  const t = useTranslations('import');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  // A structural problem the row-by-row report can't describe — a missing/renamed
  // tab or column — thrown before validation can even run. Kept on screen (not just
  // a toast) since it names exactly what to fix in the file, and re-uploading a new
  // file is the only way to recover.
  const [structuralError, setStructuralError] = useState<string | null>(null);
  // The request never got a response at all (server down, CORS, connection dropped)
  // — distinct from structuralError, which is a real response describing a problem
  // with the file. Rendered separately so we never blame the file for a server/network
  // problem, which just sends someone down the wrong troubleshooting path.
  const [networkError, setNetworkError] = useState<string | null>(null);

  const UNREACHABLE_MESSAGE = t('unreachable');
  const UNREACHABLE_DETAIL = t('unreachableDetail');

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setFile(null);
    setStage('idle');
    setReport(null);
    setSummary(null);
    setFailureMessage(null);
    setStructuralError(null);
    setNetworkError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDownloadTemplate() {
    try {
      await apiDownload('/imports/template', 'school-onboarding-template.xlsx', tenantOverride);
    } catch {
      toast(t('templateFailed'), 'error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setReport(null);
    setStructuralError(null);
    setNetworkError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleValidate() {
    if (!file) return;
    setStage('validating');
    setStructuralError(null);
    setNetworkError(null);
    try {
      const result = await apiUpload<ValidationReport>('/imports/validate', file, undefined, tenantOverride);
      setReport(result);
      setStage('validated');
    } catch (err) {
      setStage('idle');
      // A server response means a real, actionable problem with the file. Anything
      // else (fetch() itself threw) means the request never got a response at all —
      // a network/server problem, not a file problem.
      if (isServerError(err)) {
        setStructuralError(err.message);
        toast(err.message, 'error');
      } else {
        setNetworkError(UNREACHABLE_DETAIL);
        toast(UNREACHABLE_MESSAGE, 'error');
      }
    }
  }

  async function handleCommit() {
    if (!file) return;
    setStage('committing');
    try {
      const result = await apiUpload<CommitResult>('/imports/commit', file, undefined, tenantOverride);
      if (result.status === 'pending') {
        setStage('polling');
        pollJob(result.importJobId);
      } else {
        setSummary(result.summary ?? null);
        setStage('done');
        toast(t('completed'), 'success');
      }
    } catch (err) {
      setStage('validated');
      if (err instanceof ApiError && err.status === 422) {
        const freshReport = (err.body as { error?: ValidationReport } | undefined)?.error;
        if (freshReport?.tabs) setReport(freshReport);
        toast(t('noLongerValid'), 'error');
      } else {
        toast(isServerError(err) ? err.message : UNREACHABLE_MESSAGE, 'error');
      }
    }
  }

  function pollJob(jobId: string) {
    const poll = async () => {
      try {
        const status = await api.get<ImportJobStatusResponse>(`/imports/${jobId}`, { tenantOverride });
        if (status.status === 'completed') {
          setSummary(status.summary);
          setStage('done');
          toast(t('completed'), 'success');
          return;
        }
        if (status.status === 'failed') {
          const report = status.errorReport as { message?: string; totalErrors?: number } | null;
          setFailureMessage(report?.message ?? t('failedFallback'));
          setStage('done');
          return;
        }
      } catch {
        // transient network error — keep polling
      }
      pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
    };
    void poll();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('intro')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
          {t('downloadTemplate')}
        </Button>
      </div>

      {networkError && (stage === 'idle' || stage === 'validating') && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">{t('unreachableTitle')}</p>
          <p className="mt-1">{networkError}</p>
        </div>
      )}

      {structuralError && (stage === 'idle' || stage === 'validating') && (
        <StructuralErrorBanner message={structuralError} />
      )}

      {(stage === 'idle' || stage === 'validating') && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">{t('workbook')}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-teal/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-teal hover:file:bg-teal/20"
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={handleValidate} disabled={!file} loading={stage === 'validating'}>
              {t('validate')}
            </Button>
          </div>
        </div>
      )}

      {stage === 'validated' && report && <ValidationReportView report={report} />}

      {stage === 'validated' && report && (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={reset}>
            {t('chooseDifferent')}
          </Button>
          <Button onClick={handleCommit} disabled={!report.canImport}>
            {t('import')}
          </Button>
        </div>
      )}

      {stage === 'committing' && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white shadow-sm p-10 text-sm text-gray-600">
          <Spinner className="h-5 w-5 text-teal" />
          {t('writing')}
        </div>
      )}

      {stage === 'polling' && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white shadow-sm p-10 text-center text-sm text-gray-600">
          <Spinner className="h-5 w-5 text-teal" />
          <p>{t('background1')}</p>
          <p>{t('background2')}</p>
        </div>
      )}

      {stage === 'done' && summary && <ImportSummaryView summary={summary} onReset={reset} />}

      {stage === 'done' && !summary && failureMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">{t('failedTitle')}</p>
          <p className="mt-1 text-sm text-red-700">{failureMessage}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={reset}>
              {t('startOver')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const MISSING_COLUMNS_PATTERN = /^Tab "([^"]+)" is missing required column\(s\): (.+)$/;

/**
 * Structural failures (missing tab, missing/renamed column) are thrown before the
 * row-by-row validator ever runs, so there's no ValidationReport to render — just a
 * message. Parsed into a checklist when it matches the known "missing column(s)"
 * shape from workbook-parser.service.ts; otherwise shown verbatim.
 */
function StructuralErrorBanner({ message }: { message: string }) {
  const t = useTranslations('import');
  const match = message.match(MISSING_COLUMNS_PATTERN);

  if (!match) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium">{t('couldNotRead')}</p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }

  const [, tabName, columnList] = match;
  const columns = columnList.split(',').map((c) => c.trim());

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <p className="font-medium">{t('missingColumns', { tab: tabName, count: columns.length })}</p>
      <ul className="mt-2 list-disc space-y-0.5 pl-5">
        {columns.map((col) => (
          <li key={col}>
            {t.rich('addColumn', {
              column: col,
              tab: tabName,
              mono: (chunks) => <span className="font-mono font-semibold">{chunks}</span>,
            })}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-red-700">{t.rich('easiestFix', { strong: (chunks) => <strong>{chunks}</strong> })}</p>
    </div>
  );
}

function ValidationReportView({ report }: { report: ValidationReport }) {
  const t = useTranslations('import');
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-4 text-sm ${
          report.canImport ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        {report.canImport
          ? report.totalWarnings > 0
            ? t('readyWithWarnings', { count: report.totalWarnings })
            : t('readyNoWarnings')
          : t('errorsFound', { count: report.totalErrors })}
      </div>

      {report.tabs.map((tab) => (
        <div key={tab.tab} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{tab.tab}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{t('rows', { count: tab.rowCount })}</span>
              {tab.errors.length > 0 && <Badge variant="red">{t('errors', { count: tab.errors.length })}</Badge>}
              {tab.warnings.length > 0 && <Badge variant="yellow">{t('warnings', { count: tab.warnings.length })}</Badge>}
            </div>
          </div>
          {tab.errors.length === 0 && tab.warnings.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">{t('noIssues')}</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <tbody className="divide-y">
                {[...tab.errors, ...tab.warnings].map((issue, idx) => (
                  <tr key={idx}>
                    <td className="w-16 px-4 py-2 text-gray-500">{t('row', { n: issue.row })}</td>
                    <td className="w-40 px-4 py-2 text-gray-500">{issue.column ?? '—'}</td>
                    <td className={`px-4 py-2 ${idx < tab.errors.length ? 'text-red-700' : 'text-yellow-700'}`}>
                      {issue.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function ImportSummaryView({ summary, onReset }: { summary: ImportSummary; onReset: () => void }) {
  const t = useTranslations('import');
  const rows: Array<{ label: string; value: EntitySummary }> = [
    { label: t('entityClasses'), value: summary.classes },
    { label: t('entityUsers'), value: summary.users },
    { label: t('entityTeachers'), value: summary.teachers },
    { label: t('entityStudents'), value: summary.students },
    { label: t('entityFeeStructures'), value: summary.feeStructures },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        {t('success')}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 font-medium">{t('colEntity')}</th>
              <th className="py-2 font-medium">{t('colCreated')}</th>
              <th className="py-2 font-medium">{t('colUpdated')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="py-2 text-gray-900">{row.label}</td>
                <td className="py-2 text-gray-600">{row.value.created}</td>
                <td className="py-2 text-gray-600">{row.value.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.createdUserCredentials.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-900">
            {t('tempPasswords', { count: summary.createdUserCredentials.length })}
          </p>
          <p className="mt-1 text-xs text-amber-800">{t('tempPasswordsHelp')}</p>
          <table className="mt-3 w-full min-w-[480px] text-sm">
            <tbody className="divide-y divide-amber-200">
              {summary.createdUserCredentials.map((cred) => (
                <tr key={cred.email}>
                  <td className="py-2 text-amber-900">{cred.email}</td>
                  <td className="py-2 font-mono text-amber-900">{cred.temporaryPassword}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => navigator.clipboard.writeText(cred.temporaryPassword)}
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 cursor-pointer"
                    >
                      {t('copy')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onReset}>
          {t('startAnother')}
        </Button>
      </div>
    </div>
  );
}
