'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { apiDownload, apiUpload } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { useToast } from '../../../components/ui/toast';
import type { ImportResult } from './types';

/** Validate first (dry run), then import. Import is all-or-nothing and only offered when the file is clean. */
export function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const res = await apiUpload<ImportResult>(`/hrms/employees/import?dryRun=${dryRun}`, file);
      if (dryRun) setResult(res);
      else {
        toast(t('importDone', { count: res.imported }), 'success');
        onImported();
      }
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function template() {
    try {
      await apiDownload('/hrms/employees/import/template', 'employee-import-template.xlsx');
    } catch (e) {
      toast(errorText(e), 'error');
    }
  }

  const clean = !!result && result.errors.length === 0;
  return (
    <Modal open onClose={onClose} title={t('importEmployees')} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">{t('importHelp')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={template}>
            {t('downloadTemplate')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="text-sm"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
            }}
          />
        </div>
        {result && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{t('importSummary', { total: result.total, valid: result.valid })}</p>
            {result.errors.length > 0 && (
              <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3 text-xs text-red-800">
                {result.errors.map((er, i) => (
                  <li key={i}>{t('importErrorLine', { row: er.row, field: er.field, message: er.message })}</li>
                ))}
              </ul>
            )}
            {clean && <p className="text-sm text-green-700">{t('importClean')}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="secondary" loading={busy} disabled={!file} onClick={() => run(true)}>
            {t('validateFile')}
          </Button>
          <Button loading={busy} disabled={!clean} onClick={() => run(false)}>
            {t('importNow')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
