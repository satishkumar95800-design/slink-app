'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { apiDownload, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import { IMPORT_ERROR_CODES, ImportReport } from './types';

/** Upload an Excel sheet of topics: check it first, then write it. */
export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('syllabus');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);

  async function check(f: File) {
    setFile(f);
    setReport(null);
    setReplace(false);
    setBusy(true);
    try {
      setReport(await apiUpload<ImportReport>('/syllabus/import/validate', f));
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
      const res = await apiUpload<{ plans: number; topics: number }>(
        `/syllabus/import/commit${replace ? '?replace=true' : ''}`,
        file,
      );
      toast(t('importDone', { plans: res.plans, topics: res.topics }), 'success');
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const errorLine = (e: ImportReport['errors'][number]) => {
    const known = (IMPORT_ERROR_CODES as readonly string[]).includes(e.code);
    const text = known ? t(`importError.${e.code as (typeof IMPORT_ERROR_CODES)[number]}`, { value: e.value ?? '' }) : e.code;
    return e.row > 0 ? t('importRow', { row: e.row, text }) : text;
  };

  const existing = report?.plans.filter((p) => p.existingTopics > 0) ?? [];
  const coveredLost = existing.reduce((s, p) => s + p.existingCovered, 0);
  const canCommit = !!report && report.errors.length === 0 && report.rows > 0 && (existing.length === 0 || replace);

  return (
    <Modal open onClose={onClose} title={t('importTitle')} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{t('importHelp')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => apiDownload('/syllabus/import/template', 'syllabus-template.xlsx').catch((e) => toast(errorText(e), 'error'))}>
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
            <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5">
              {report.errors.slice(0, 50).map((e, i) => (
                <li key={i}>{errorLine(e)}</li>
              ))}
            </ul>
          </div>
        )}

        {report && report.errors.length === 0 && (
          <div className="rounded-xl border border-black/5 bg-white p-3 text-sm">
            <p className="font-semibold text-gray-900">{t('importReady', { topics: report.rows, plans: report.plans.length })}</p>
            <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-gray-600">
              {report.plans.map((p) => (
                <li key={`${p.className}-${p.subjectName}`}>
                  {t('importPlanLine', { className: p.className, subject: p.subjectName, count: p.topics })}
                  {p.existingTopics > 0 && <span className="text-amber-700"> · {t('importReplaces', { count: p.existingTopics })}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {existing.length > 0 && report?.errors.length === 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-coral" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            <span>{coveredLost > 0 ? t('importReplaceCovered', { count: existing.length, covered: coveredLost }) : t('importReplace', { count: existing.length })}</span>
          </label>
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
