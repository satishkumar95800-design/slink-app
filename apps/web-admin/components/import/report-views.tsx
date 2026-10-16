'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '../ui/badge';

export interface ImportIssue {
  tab: string;
  row: number;
  column?: string;
  reason: string;
}

export interface TabReport {
  tab: string;
  rowCount: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ValidationReport {
  tabs: TabReport[];
  totalErrors: number;
  totalWarnings: number;
  canImport: boolean;
}

const MISSING_COLUMNS_PATTERN = /^Tab "([^"]+)" is missing required column\(s\): (.+)$/;

export function StructuralErrorBanner({ message }: { message: string }) {
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

export function ValidationReportView({ report }: { report: ValidationReport }) {
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
