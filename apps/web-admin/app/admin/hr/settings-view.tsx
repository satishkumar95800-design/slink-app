'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { weekdayName } from '../../../lib/format';
import { useLanguage } from '../../../lib/i18n/provider';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { HrSettings, PtSlab, WORKING_DAYS_RULES, WorkingDaysRule } from './types';

/** Payroll and attendance rules. Statutory rates change money, so only an admin can save. */
export function SettingsView({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [s, setS] = useState<HrSettings | null>(null);
  const [slabs, setSlabs] = useState<PtSlab[]>([]);
  const [saving, setSaving] = useState(false);

  function apply(x: HrSettings) {
    setS(x);
    setSlabs(x.ptSlabs);
  }

  useEffect(() => {
    api
      .get<HrSettings>('/hrms/settings')
      .then(apply)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!s)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  const set = <K extends keyof HrSettings>(k: K, v: HrSettings[K]) => setS({ ...s, [k]: v });
  const num = (v: string) => (v === '' ? 0 : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    try {
      const res = await api.put<HrSettings>('/hrms/settings', {
        weeklyOffDays: s.weeklyOffDays,
        workingDaysRule: s.workingDaysRule,
        treatUnmarkedAsAbsent: s.treatUnmarkedAsAbsent,
        leaveYearStartMonth: s.leaveYearStartMonth,
        pfEnabled: s.pfEnabled,
        pfEmployeeRate: s.pfEmployeeRate,
        pfEmployerRate: s.pfEmployerRate,
        pfWageCeiling: Number(s.pfWageCeiling),
        esiEnabled: s.esiEnabled,
        esiEmployeeRate: s.esiEmployeeRate,
        esiEmployerRate: s.esiEmployerRate,
        esiWageCeiling: Number(s.esiWageCeiling),
        ptEnabled: s.ptEnabled,
        ptSlabs: slabs.map((p) => ({
          from: Number(p.from),
          to: p.to === null || p.to === '' ? null : Number(p.to),
          monthly: Number(p.monthly),
          ...(p.february !== null && p.february !== '' ? { february: Number(p.february) } : {}),
        })),
      });
      apply(res);
      toast(t('settingsSaved'), 'success');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  const toggleDay = (d: number) =>
    set('weeklyOffDays', s.weeklyOffDays.includes(d) ? s.weeklyOffDays.filter((x) => x !== d) : [...s.weeklyOffDays, d].sort());
  const updateSlab = (i: number, patch: Partial<PtSlab>) => setSlabs(slabs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <form onSubmit={save} className="space-y-5">
      {!isAdmin && <p className="text-sm text-gray-500">{t('settingsAdminOnly')}</p>}
      <fieldset disabled={!isAdmin} className="space-y-5">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{t('rulesTitle')}</h2>
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">{t('weeklyOffDays')}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={s.weeklyOffDays.includes(d)} onChange={() => toggleDay(d)} />
                    {weekdayName(d === 0 ? 7 : d, language, 'short')}
                  </label>
                ))}
              </div>
            </div>
            <Select
              label={t('workingDaysRule')}
              value={s.workingDaysRule}
              onChange={(e) => set('workingDaysRule', e.target.value as WorkingDaysRule)}
              options={WORKING_DAYS_RULES.map((r) => ({ value: r, label: t(`rule.${r}`) }))}
            />
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={s.treatUnmarkedAsAbsent} onChange={(e) => set('treatUnmarkedAsAbsent', e.target.checked)} />
              {t('treatUnmarkedAsAbsent')}
            </label>
            <Input label={t('leaveYearStartMonth')} type="number" min="1" max="12" value={s.leaveYearStartMonth} onChange={(e) => set('leaveYearStartMonth', num(e.target.value))} helpText={t('leaveYearHelp')} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{t('pfTitle')}</h2>
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={s.pfEnabled} onChange={(e) => set('pfEnabled', e.target.checked)} />
            {t('enabled')}
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input label={t('employeeRate')} type="number" min="0" max="100" step="0.01" value={s.pfEmployeeRate} onChange={(e) => set('pfEmployeeRate', num(e.target.value))} />
            <Input label={t('employerRate')} type="number" min="0" max="100" step="0.01" value={s.pfEmployerRate} onChange={(e) => set('pfEmployerRate', num(e.target.value))} />
            <Input label={t('wageCeiling')} type="number" min="0" step="0.01" value={s.pfWageCeiling} onChange={(e) => set('pfWageCeiling', e.target.value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{t('esiTitle')}</h2>
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={s.esiEnabled} onChange={(e) => set('esiEnabled', e.target.checked)} />
            {t('enabled')}
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input label={t('employeeRate')} type="number" min="0" max="100" step="0.01" value={s.esiEmployeeRate} onChange={(e) => set('esiEmployeeRate', num(e.target.value))} />
            <Input label={t('employerRate')} type="number" min="0" max="100" step="0.01" value={s.esiEmployerRate} onChange={(e) => set('esiEmployerRate', num(e.target.value))} />
            <Input label={t('wageCeiling')} type="number" min="0" step="0.01" value={s.esiWageCeiling} onChange={(e) => set('esiWageCeiling', e.target.value)} />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">{t('ptTitle')}</h2>
          <p className="mt-1 text-xs text-amber-800">{t('ptDefaultsNote')}</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={s.ptEnabled} onChange={(e) => set('ptEnabled', e.target.checked)} />
            {t('enabled')}
          </label>
          <div className="mt-3 space-y-2">
            {slabs.map((p, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-5">
                <Input label={t('slabFrom')} type="number" min="0" step="0.01" value={p.from} onChange={(e) => updateSlab(i, { from: e.target.value })} />
                <Input label={t('slabTo')} type="number" min="0" step="0.01" value={p.to ?? ''} placeholder={t('noUpperLimit')} onChange={(e) => updateSlab(i, { to: e.target.value === '' ? null : e.target.value })} />
                <Input label={t('slabMonthly')} type="number" min="0" step="0.01" value={p.monthly} onChange={(e) => updateSlab(i, { monthly: e.target.value })} />
                <Input label={t('slabFebruary')} type="number" min="0" step="0.01" value={p.february ?? ''} onChange={(e) => updateSlab(i, { february: e.target.value === '' ? null : e.target.value })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}>
                  {tCommon('remove')}
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setSlabs([...slabs, { from: slabs.length ? String(Number(slabs[slabs.length - 1].to ?? 0) + 1) : '0', to: null, monthly: '0', february: null }])}>
              {t('addSlab')}
            </Button>
          </div>
        </section>
      </fieldset>
      {isAdmin && (
        <Button type="submit" loading={saving}>
          {tCommon('save')}
        </Button>
      )}
    </form>
  );
}
