'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { apiDownload, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import { IMPORT_ERROR_CODES, ImportIssue, ImportReport } from './types';

/** Upload the routes and students workbook: check it first, then import. */
export function ImportBusDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('schoolBus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(f: File) {
    setFile(f);
    setReport(null);
    setBusy(true);
    try {
      setReport(await apiUpload<ImportReport>('/transport/import/validate', f));
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function commit() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await apiUpload<{ routes: number; students: number }>('/transport/import/commit', file);
      toast(t('importDone', { routes: res.routes, students: res.students }), 'success');
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const line = (e: ImportIssue) => {
    const known = (IMPORT_ERROR_CODES as readonly string[]).includes(e.code);
    const text = known ? t(`importError.${e.code as (typeof IMPORT_ERROR_CODES)[number]}`, { value: e.value ?? '', detail: e.detail ?? '' }) : e.code;
    return e.row > 0 ? t('importRow', { sheet: e.sheet === 'routes' ? t('sheetRoutes') : t('sheetStudents'), row: e.row, text }) : text;
  };

  const nothing = !!report && report.routes === 0 && report.students === 0;
  const canCommit = !!report && report.errors.length === 0 && !nothing;

  return (
    <Modal open onClose={onClose} title={t('importTitle')} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('importHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => apiDownload('/transport/import/template', 'school-bus-template.xlsx').catch((e) => toast(errorText(e), 'error'))}>
            {t('downloadTemplate')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && check(e.target.files[0])}
          />
          <Button size="sm" loading={busy && !report} onClick={() => fileRef.current?.click()}>
            {file ? t('chooseAnother') : t('chooseFile')}
          </Button>
          {file && <span className="self-center text-sm text-gray-600">{file.name}</span>}
        </div>

        {report && report.errors.length > 0 && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">{t('importHasErrors', { count: report.errors.length })}</p>
            <ul className="mt-2 max-h-56 list-disc space-y-0.5 overflow-y-auto pl-5">
              {report.errors.slice(0, 100).map((e, i) => (
                <li key={i}>{line(e)}</li>
              ))}
            </ul>
          </div>
        )}

        {report && report.errors.length === 0 && (
          <div className="rounded-xl border border-black/5 bg-white p-3 text-sm">
            <p className="font-semibold text-gray-900">{nothing ? t('importNothing') : t('importReady')}</p>
            {!nothing && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-gray-700">
                {report.routes > 0 && <li>{t('importRoutes', { routes: report.routes, stops: report.stops })}</li>}
                {report.staffMatched > 0 && <li>{t('importStaffMatched', { count: report.staffMatched })}</li>}
                {report.staffAdded > 0 && <li>{t('importStaffAdded', { count: report.staffAdded })}</li>}
                {report.students > 0 && <li className="font-semibold">{t('importStudents', { count: report.students })}</li>}
              </ul>
            )}
          </div>
        )}

        {report && report.warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">{t('importWarnings', { count: report.warnings.length })}</p>
            <ul className="mt-2 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
              {report.warnings.slice(0, 100).map((e, i) => (
                <li key={i}>{line(e)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={busy && !!report} disabled={!canCommit} onClick={commit}>
            {t('importCommit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
