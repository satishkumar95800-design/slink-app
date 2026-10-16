'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatMonthYear, formatRupees } from '../../../lib/format';
import { useLanguage } from '../../../lib/i18n/provider';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { RunDetail } from './run-detail';
import { SettingsView } from './settings-view';
import { StructuresView } from './structures-view';
import { PayRun, PayRunDetail, RunStatus } from './types';

type View = 'runs' | 'structures' | 'settings';
export const RUN_VARIANT: Record<RunStatus, 'gray' | 'yellow' | 'blue' | 'green' | 'red'> = {
  DRAFT: 'gray',
  REVIEW: 'yellow',
  APPROVED: 'blue',
  LOCKED: 'green',
  CANCELLED: 'red',
};

export function PayrollTab({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('hr');
  const [view, setView] = useState<View>('runs');
  const [openRun, setOpenRun] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">{t('verifyStatutory')}</p>
      {openRun ? (
        <RunDetail id={openRun} isAdmin={isAdmin} onBack={() => setOpenRun(null)} />
      ) : (
        <>
          <div className="flex gap-2">
            {(['runs', 'structures', 'settings'] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? 'primary' : 'secondary'} onClick={() => setView(v)}>
                {t(`payrollView.${v}`)}
              </Button>
            ))}
          </div>
          {view === 'runs' && <Runs onOpen={setOpenRun} />}
          {view === 'structures' && <StructuresView />}
          {view === 'settings' && <SettingsView isAdmin={isAdmin} />}
        </>
      )}
    </div>
  );
}

function Runs({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [runs, setRuns] = useState<PayRun[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [month, setMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<PayRun[]>('/hrms/payroll/runs')
      .then(setRuns)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const run = await api.post<PayRunDetail>('/hrms/payroll/runs', { month });
      if (run.skipped?.length) toast(t('generatedSkipped', { count: run.skipped.length }), 'success');
      else toast(t('generated'), 'success');
      setGenerating(false);
      onOpen(run.id);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!runs)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  return (
    <div className="space-y-4">
      <Button size="sm" onClick={() => setGenerating(true)}>
        {t('newPayRun')}
      </Button>
      {runs.length === 0 ? (
        <EmptyState title={t('noPayRuns')} description={t('noPayRunsHelp')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">{t('month')}</th>
                <th className="px-4 py-2">{t('colStatus')}</th>
                <th className="px-4 py-2">{t('employeesCount')}</th>
                <th className="px-4 py-2">{t('gross')}</th>
                <th className="px-4 py-2">{t('deductions')}</th>
                <th className="px-4 py-2">{t('netPay')}</th>
                <th className="px-4 py-2">{t('paid')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-teal/5" onClick={() => onOpen(r.id)}>
                  <td className="px-4 py-2 font-medium text-gray-900">{formatMonthYear(r.month, language)}</td>
                  <td className="px-4 py-2">
                    <Badge variant={RUN_VARIANT[r.status]}>{t(`runStatus.${r.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-2">{r.totals?.employees ?? 0}</td>
                  <td className="px-4 py-2">{formatRupees(r.totals?.gross)}</td>
                  <td className="px-4 py-2">{formatRupees(r.totals?.deductions)}</td>
                  <td className="px-4 py-2 font-semibold">{formatRupees(r.totals?.net)}</td>
                  <td className="px-4 py-2">{r.paidAt ? t('yesPaid') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={generating} onClose={() => setGenerating(false)} title={t('newPayRun')} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('generateHelp')}</p>
          <Input label={t('month')} type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGenerating(false)}>
              {tCommon('cancel')}
            </Button>
            <Button loading={busy} onClick={generate}>
              {t('generate')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
