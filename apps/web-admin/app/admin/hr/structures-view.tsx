'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useErrorText } from '../../../lib/i18n/errors';
import { formatDateOnly, formatRupees } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Modal } from '../../../components/ui/modal';
import { Select } from '../../../components/ui/select';
import { Spinner } from '../../../components/ui/spinner';
import { useToast } from '../../../components/ui/toast';
import { Coverage, SalaryStructure } from './types';

interface ComponentDraft {
  name: string;
  kind: 'EARNING' | 'DEDUCTION';
  calc: 'FIXED' | 'PERCENT_OF_BASIC';
  value: string;
}

/** Effective-dated salary structures. A change is a new structure with a later start date, never an edit. */
export function StructuresView() {
  const t = useTranslations('hr');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<Coverage[] | null>(null);
  const [version, setVersion] = useState(0);
  const [target, setTarget] = useState<Coverage | null>(null);
  const [history, setHistory] = useState<Coverage | null>(null);

  useEffect(() => {
    api
      .get<Coverage[]>('/hrms/payroll/structures/coverage')
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  if (!rows)
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner className="h-6 w-6 text-teal" />
      </div>
    );
  const missing = rows.filter((r) => !r.current).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{t('structuresHelp')}</p>
      {missing > 0 && <p className="text-sm text-amber-800">{t('missingStructures', { count: missing })}</p>}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">{t('colName')}</th>
              <th className="px-4 py-2">{t('colDesignation')}</th>
              <th className="px-4 py-2">{t('effectiveFrom')}</th>
              <th className="px-4 py-2">{t('basic')}</th>
              <th className="px-4 py-2">{t('monthlyGross')}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.employeeId}>
                <td className="px-4 py-2 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-2">{r.designation}</td>
                <td className="px-4 py-2">{r.current ? formatDateOnly(r.current.effectiveFrom) : <Badge variant="orange">{t('noStructure')}</Badge>}</td>
                <td className="px-4 py-2">{r.current ? formatRupees(r.current.basic) : '—'}</td>
                <td className="px-4 py-2">{r.current ? formatRupees(r.current.monthlyGross) : '—'}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <Button size="sm" variant="secondary" onClick={() => setTarget(r)}>
                    {r.current ? t('newStructure') : t('addStructure')}
                  </Button>{' '}
                  {r.current && (
                    <Button size="sm" variant="ghost" onClick={() => setHistory(r)}>
                      {t('history')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {target && (
        <StructureModal
          target={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {history && <HistoryModal target={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function StructureModal({ target, onClose, onSaved }: { target: Coverage; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations('hr');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const { toast } = useToast();
  const cur = target.current;
  const [from, setFrom] = useState(new Date().toLocaleDateString('en-CA'));
  const [basic, setBasic] = useState(cur?.basic ?? '');
  const [comps, setComps] = useState<ComponentDraft[]>(
    cur
      ? cur.components.map((c) => ({ name: c.name, kind: c.kind, calc: c.calc, value: c.calc === 'FIXED' ? (c.amount ?? '') : String(c.percent ?? '') }))
      : [{ name: 'HRA', kind: 'EARNING', calc: 'PERCENT_OF_BASIC', value: '40' }],
  );
  const [pf, setPf] = useState(cur?.pfApplicable ?? false);
  const [esi, setEsi] = useState(cur?.esiApplicable ?? false);
  const [pt, setPt] = useState(cur?.ptApplicable ?? false);
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<ComponentDraft>) => setComps(comps.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function save() {
    setSaving(true);
    try {
      await api.post('/hrms/payroll/structures', {
        employeeId: target.employeeId,
        effectiveFrom: from,
        basic: Number(basic),
        components: comps
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name.trim(),
            kind: c.kind,
            calc: c.calc,
            ...(c.calc === 'FIXED' ? { amount: Number(c.value || 0) } : { percent: Number(c.value || 0) }),
          })),
        pfApplicable: pf,
        esiApplicable: esi,
        ptApplicable: pt,
      });
      toast(t('structureSaved'), 'success');
      onSaved();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('structureFor', { name: target.name })} size="xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('effectiveFrom')} type="date" required value={from} onChange={(e) => setFrom(e.target.value)} helpText={t('effectiveHelp')} />
          <Input label={t('basicMonthly')} type="number" min="0" step="0.01" required value={basic} onChange={(e) => setBasic(e.target.value)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{t('components')}</p>
          <div className="mt-2 space-y-2">
            {comps.map((c, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-5">
                <Input label={t('componentName')} value={c.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} />
                <Select label={t('componentKind')} value={c.kind} onChange={(e) => update(i, { kind: e.target.value as ComponentDraft['kind'] })} options={[{ value: 'EARNING', label: t('earning') }, { value: 'DEDUCTION', label: t('deduction') }]} />
                <Select label={t('componentCalc')} value={c.calc} onChange={(e) => update(i, { calc: e.target.value as ComponentDraft['calc'] })} options={[{ value: 'FIXED', label: t('calcFixed') }, { value: 'PERCENT_OF_BASIC', label: t('calcPercent') }]} />
                <Input label={c.calc === 'FIXED' ? t('amountRupees') : t('percentOfBasic')} type="number" min="0" step="0.01" value={c.value} onChange={(e) => update(i, { value: e.target.value })} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setComps(comps.filter((_, j) => j !== i))}>
                  {tCommon('remove')}
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={() => setComps([...comps, { name: '', kind: 'EARNING', calc: 'FIXED', value: '' }])}>
              {t('addComponent')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('tdsHint')}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pf} onChange={(e) => setPf(e.target.checked)} />
            {t('pfApplicable')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={esi} onChange={(e) => setEsi(e.target.checked)} />
            {t('esiApplicable')}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pt} onChange={(e) => setPt(e.target.checked)} />
            {t('ptApplicable')}
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button loading={saving} disabled={!from || basic === ''} onClick={save}>
            {tCommon('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HistoryModal({ target, onClose }: { target: Coverage; onClose: () => void }) {
  const t = useTranslations('hr');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [list, setList] = useState<SalaryStructure[] | null>(null);
  useEffect(() => {
    api
      .get<SalaryStructure[]>(`/hrms/payroll/structures?employeeId=${target.employeeId}`)
      .then(setList)
      .catch((e) => toast(errorText(e), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal open onClose={onClose} title={t('structureHistory', { name: target.name })} size="lg">
      {!list ? (
        <Spinner className="h-6 w-6 text-teal" />
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id} className="rounded-xl border border-gray-100 p-3 text-sm">
              <p className="font-semibold text-gray-900">
                {formatDateOnly(s.effectiveFrom)} · {t('basic')} {formatRupees(s.basic)} · {t('monthlyGross')} {formatRupees(s.monthlyGross)}
              </p>
              <p className="text-xs text-gray-500">
                {s.components.map((c) => `${c.name} ${c.calc === 'FIXED' ? formatRupees(c.amount) : `${c.percent}%`}${c.kind === 'DEDUCTION' ? ` (${t('deduction')})` : ''}`).join(' · ') || '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
