'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { getSession } from '../../../lib/auth';
import { formatDateOnly } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { useTenantFeaturesState } from '../../../lib/tenant-features';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Drawer } from '../../../components/ui/drawer';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { EnquiryDrawerBody } from './enquiry-drawer';
import { EnquiryFields, FormValues, emptyForm, formValid, toBody } from './enquiry-form';
import { Enquiry, STAGES, STAGE_VARIANT, Stage, Summary } from './types';

/** Admissions pipeline (flag `admissions`): admin and accounts. */
export default function AdmissionsPage() {
  const t = useTranslations('admissions');
  const { features, loaded } = useTenantFeaturesState();
  if (!loaded)
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-teal" />
      </div>
    );
  const role = getSession()?.role;
  if (role !== 'admin' && role !== 'accounts') return <EmptyState title={t('noAccess')} />;
  if (!features.admissions) return <EmptyState title={t('featureOffTitle')} description={t('featureOff')} />;
  return <Admissions />;
}

function Admissions() {
  const t = useTranslations('admissions');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Enquiry[] | null>(null);
  const [stage, setStage] = useState<Stage | ''>('');
  const [due, setDue] = useState<'today' | 'overdue' | ''>('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Enquiry | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (stage) params.set('stage', stage);
    if (due) params.set('due', due);
    if (q.trim()) params.set('q', q.trim());
    api
      .get<{ data: Enquiry[] }>(`/admissions?${params}`)
      .then((r) => setRows(r.data))
      .catch((e) => {
        setRows([]);
        toast(errorText(e), 'error');
      });
    api.get<Summary>('/admissions/summary').then(setSummary).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, due, q]);
  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  const f = summary?.funnel;
  const steps = f
    ? [
        { label: t('funnel.enquiries'), value: f.enquiries },
        { label: t('funnel.tours'), value: f.tours },
        { label: t('funnel.registrations'), value: f.registrations },
        { label: t('funnel.enrolled'), value: f.enrolled },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" />
          {t('addEnquiry')}
        </Button>
      </div>

      {f && summary && (
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">{t('funnelTitle', { date: formatDateOnly(summary.academicYearFrom) })}</h2>
            <p className="text-sm text-gray-600">
              {t('conversion', { pct: f.conversionPct ?? 0 })} · {t('lostCount', { count: f.lost })}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {steps.map((s, i) => (
              <div key={s.label} className="rounded-2xl bg-cream/70 p-3">
                <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs font-semibold text-gray-600">{s.label}</p>
                {i > 0 && f.enquiries > 0 && <p className="text-xs text-gray-500">{t('ofEnquiries', { pct: Math.round((s.value / f.enquiries) * 100) })}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {summary && summary.followUps.overdue > 0 && (
          <button
            type="button"
            onClick={() => setDue(due === 'overdue' ? '' : 'overdue')}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ${due === 'overdue' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700'}`}
          >
            {t('overdueChip', { count: summary.followUps.overdue })}
          </button>
        )}
        {summary && summary.followUps.today > 0 && (
          <button
            type="button"
            onClick={() => setDue(due === 'today' ? '' : 'today')}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold ${due === 'today' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800'}`}
          >
            {t('todayChip', { count: summary.followUps.today })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm">
          {(['', ...STAGES] as (Stage | '')[]).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStage(s)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${stage === s ? 'bg-teal text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {s ? t(`stages.${s}`) : t('all')}
              {s && summary?.stages[s] ? ` · ${summary.stages[s]}` : ''}
            </button>
          ))}
        </div>
        <div className="w-full max-w-xs">
          <Input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('search')} />
        </div>
      </div>

      {!rows ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner className="h-8 w-8 text-teal" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-cream/60">
              <tr>
                {[t('colChild'), t('colParent'), t('colSource'), t('colStage'), t('colFollowUp')].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal/80">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => setOpen(r)}
                  onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}
                  className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                >
                  <td className="px-4 py-3 text-sm">
                    <p className="font-medium text-gray-900">{r.childName}</p>
                    {r.classSought && <p className="text-xs text-gray-500">{r.classSought}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <p className="text-gray-900">{r.parentName}</p>
                    <p className="text-xs text-gray-500">{r.phone}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{t(`sources.${r.source}`)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STAGE_VARIANT[r.stage]}>{t(`stages.${r.stage}`)}</Badge>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-sm ${r.followUpDue ? 'font-semibold text-red-600' : 'text-gray-600'}`}>
                    {r.nextFollowUpOn ? formatDateOnly(r.nextFollowUpOn) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.childName ?? ''} subtitle={open ? t('drawerSubtitle', { parent: open.parentName, phone: open.phone }) : ''} icon={<UserPlus className="h-5 w-5" />}>
        {open && <EnquiryDrawerBody key={open.id} id={open.id} onChanged={load} />}
      </Drawer>

      {adding && (
        <AddEnquiry
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddEnquiry({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const t = useTranslations('admissions');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [form, setForm] = useState<FormValues>(emptyForm());
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api.post('/admissions', toBody(form, false));
      toast(t('added'), 'success');
      onDone();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={t('addEnquiry')} size="lg">
      <div className="space-y-4">
        <EnquiryFields value={form} onChange={setForm} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!formValid(form)} onClick={save}>
            {t('addEnquiry')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
