'use client';

import { useRef, useState } from 'react';
import { api, apiUpload, apiDownload, ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { Spinner } from '../../../components/ui/spinner';
import { Badge } from '../../../components/ui/badge';
import { useToast } from '../../../components/ui/toast';

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

export default function ImportPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  function reset() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setFile(null);
    setStage('idle');
    setReport(null);
    setSummary(null);
    setFailureMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDownloadTemplate() {
    try {
      await apiDownload('/imports/template', 'school-onboarding-template.xlsx');
    } catch {
      toast('Could not download the template', 'error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setReport(null);
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleValidate() {
    if (!file) return;
    setStage('validating');
    try {
      const result = await apiUpload<ValidationReport>('/imports/validate', file);
      setReport(result);
      setStage('validated');
    } catch (err) {
      setStage('idle');
      toast(err instanceof ApiError ? err.message : 'Validation failed', 'error');
    }
  }

  async function handleCommit() {
    if (!file) return;
    setStage('committing');
    try {
      const result = await apiUpload<CommitResult>('/imports/commit', file);
      if (result.status === 'pending') {
        setStage('polling');
        pollJob(result.importJobId);
      } else {
        setSummary(result.summary ?? null);
        setStage('done');
        toast('Import completed', 'success');
      }
    } catch (err) {
      setStage('validated');
      if (err instanceof ApiError && err.status === 422) {
        const freshReport = (err.body as { error?: ValidationReport } | undefined)?.error;
        if (freshReport?.tabs) setReport(freshReport);
        toast('This file no longer validates — see the errors below', 'error');
      } else {
        toast(err instanceof ApiError ? err.message : 'Import failed', 'error');
      }
    }
  }

  function pollJob(jobId: string) {
    const poll = async () => {
      try {
        const status = await api.get<ImportJobStatusResponse>(`/imports/${jobId}`);
        if (status.status === 'completed') {
          setSummary(status.summary);
          setStage('done');
          toast('Import completed', 'success');
          return;
        }
        if (status.status === 'failed') {
          const report = status.errorReport as { message?: string; totalErrors?: number } | null;
          setFailureMessage(report?.message ?? 'Import failed — see the server logs for details');
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
      <div className="flex items-start justify-between rounded-lg border bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Bulk onboarding import</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload a filled-in template to create classes, staff accounts, students, and fee structures in one step.
            Nothing is saved until validation passes and you click Import.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
          Download template
        </Button>
      </div>

      {(stage === 'idle' || stage === 'validating') && (
        <div className="rounded-lg border bg-white p-5">
          <label className="mb-2 block text-sm font-medium text-gray-700">Workbook (.xlsx)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          <div className="mt-4 flex justify-end">
            <Button onClick={handleValidate} disabled={!file} loading={stage === 'validating'}>
              Validate
            </Button>
          </div>
        </div>
      )}

      {stage === 'validated' && report && <ValidationReportView report={report} />}

      {stage === 'validated' && report && (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={reset}>
            Choose a different file
          </Button>
          <Button onClick={handleCommit} disabled={!report.canImport}>
            Import
          </Button>
        </div>
      )}

      {stage === 'committing' && (
        <div className="flex items-center justify-center gap-3 rounded-lg border bg-white p-10 text-sm text-gray-600">
          <Spinner className="h-5 w-5 text-blue-600" />
          Writing changes…
        </div>
      )}

      {stage === 'polling' && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-white p-10 text-center text-sm text-gray-600">
          <Spinner className="h-5 w-5 text-blue-600" />
          <p>This file is large enough to process in the background.</p>
          <p>This page will update automatically — feel free to keep working elsewhere.</p>
        </div>
      )}

      {stage === 'done' && summary && <ImportSummaryView summary={summary} onReset={reset} />}

      {stage === 'done' && !summary && failureMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">Import failed</p>
          <p className="mt-1 text-sm text-red-700">{failureMessage}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={reset}>
              Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationReportView({ report }: { report: ValidationReport }) {
  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-4 text-sm ${
          report.canImport ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}
      >
        {report.canImport
          ? `No errors found${report.totalWarnings > 0 ? ` (${report.totalWarnings} warning${report.totalWarnings === 1 ? '' : 's'})` : ''} — ready to import.`
          : `${report.totalErrors} error${report.totalErrors === 1 ? '' : 's'} found — fix these in the file and re-upload.`}
      </div>

      {report.tabs.map((tab) => (
        <div key={tab.tab} className="rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">{tab.tab}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{tab.rowCount} row{tab.rowCount === 1 ? '' : 's'}</span>
              {tab.errors.length > 0 && <Badge variant="red">{tab.errors.length} error{tab.errors.length === 1 ? '' : 's'}</Badge>}
              {tab.warnings.length > 0 && (
                <Badge variant="yellow">{tab.warnings.length} warning{tab.warnings.length === 1 ? '' : 's'}</Badge>
              )}
            </div>
          </div>
          {tab.errors.length === 0 && tab.warnings.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">No issues</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {[...tab.errors, ...tab.warnings].map((issue, idx) => (
                  <tr key={idx}>
                    <td className="w-16 px-4 py-2 text-gray-500">Row {issue.row}</td>
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
  const rows: Array<{ label: string; value: EntitySummary }> = [
    { label: 'Classes', value: summary.classes },
    { label: 'Users', value: summary.users },
    { label: 'Students', value: summary.students },
    { label: 'Fee structures', value: summary.feeStructures },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Import completed successfully.
      </div>

      <div className="rounded-lg border bg-white p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 font-medium">Entity</th>
              <th className="py-2 font-medium">Created</th>
              <th className="py-2 font-medium">Updated</th>
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
            Temporary passwords for {summary.createdUserCredentials.length} new account
            {summary.createdUserCredentials.length === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            These are shown once and cannot be retrieved later — share them with each person now, or reset their
            password from the Users screen if you lose this list.
          </p>
          <table className="mt-3 w-full text-sm">
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
                      Copy
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
          Start another import
        </Button>
      </div>
    </div>
  );
}
