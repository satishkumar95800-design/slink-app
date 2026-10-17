'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../../../lib/api-client';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { useToast } from '../../../../components/ui/toast';
import {
  INCLUDED_IN_ALL,
  MODULES,
  ModuleGroup,
  ModuleKey,
  PLANS,
  PRESETS,
  PlanKey,
  Subscription,
  inr,
  planName,
} from '../../plans';

const GROUPS: { key: ModuleGroup; title: string; help: string }[] = [
  { key: 'premium', title: 'Premium', help: 'In Premium and Premium Max.' },
  { key: 'premium_max', title: 'Premium Max', help: 'In Premium Max; add-ons for Premium.' },
];

interface Undo {
  plan: PlanKey;
  flags: Record<ModuleKey, boolean>;
  label: string;
}

/**
 * Plan picker and modules, grouped like the price list. Picking a plan applies
 * it at once (plan + module preset); Undo restores the previous plan and
 * switches for 10 seconds.
 */
export function ModulesCard({
  tenant,
  onSaved,
}: {
  tenant: { id: string; name: string; features?: Record<string, boolean>; subscription: Subscription };
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const plan = tenant.subscription.plan;
  const on = (k: ModuleKey) => tenant.features?.[k] === true;
  const currentFlags = () => Object.fromEntries(MODULES.map((m) => [m.key, on(m.key)])) as Record<ModuleKey, boolean>;

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(timer);
  }, [undo]);

  async function choosePlan(next: PlanKey) {
    if (next === plan || saving) return;
    const before = currentFlags();
    const turnsOn = MODULES.filter((m) => PRESETS[next].includes(m.key) && !before[m.key]).map((m) => m.name);
    const turnsOff = MODULES.filter((m) => !PRESETS[next].includes(m.key) && before[m.key]).map((m) => m.name);
    setSaving('plan');
    try {
      await api.patch(`/tenants/${tenant.id}/subscription`, { plan: next });
      setUndo({
        plan,
        flags: before,
        label: [
          `${tenant.name} is now on ${planName(next)}.`,
          turnsOn.length ? `Turned on: ${turnsOn.join(', ')}.` : '',
          turnsOff.length ? `Turned off: ${turnsOff.join(', ')}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not change plan', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function revert() {
    if (!undo) return;
    setSaving('plan');
    try {
      await api.patch(`/tenants/${tenant.id}/subscription`, { plan: undo.plan });
      await api.patch(`/tenants/${tenant.id}/features`, undo.flags);
      toast(`Back on ${planName(undo.plan)}`, 'success');
      setUndo(null);
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not undo', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function toggle(key: ModuleKey, value: boolean) {
    setSaving(key);
    try {
      await api.patch(`/tenants/${tenant.id}/features`, { [key]: value });
      toast(`${MODULES.find((m) => m.key === key)!.name} ${value ? 'turned on' : 'turned off'}`, 'success');
      onSaved();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not update module', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">Plan and modules</h2>
      <p className="mt-1 text-sm text-gray-500">Picking a plan switches its modules on at once. Single modules can then be switched on as add-ons.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.key === plan;
          return (
            <button
              key={p.key}
              type="button"
              disabled={saving === 'plan'}
              onClick={() => choosePlan(p.key)}
              aria-pressed={current}
              className={`relative rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                current ? 'border-teal bg-teal/5' : 'cursor-pointer border-gray-200 bg-white hover:border-teal/50'
              }`}
            >
              {current && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-teal text-white">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
              <p className="text-sm font-bold text-gray-900">{p.name}</p>
              <p className="text-sm text-gray-700">{inr(p.price)} / year</p>
              <p className="text-xs text-gray-500">
                {p.students.toLocaleString('en-IN')} students · {inr(p.extraStudent)} per extra
              </p>
            </button>
          );
        })}
      </div>

      {undo && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal">
          <span>{undo.label}</span>
          <Button size="sm" variant="secondary" loading={saving === 'plan'} onClick={revert}>
            Undo
          </Button>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
          <h3 className="text-sm font-bold text-gray-900">Every plan</h3>
          <p className="text-xs text-gray-500">Always on, from Basic up.</p>
          <ul className="mt-3 space-y-1.5">
            {INCLUDED_IN_ALL.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-gray-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>
        {GROUPS.map((g) => (
          <section key={g.key} className="rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900">{g.title}</h3>
            <p className="text-xs text-gray-500">{g.help}</p>
            <ul className="mt-2 divide-y divide-gray-100">
              {MODULES.filter((m) => m.group === g.key).map((m) => {
                const isOn = on(m.key);
                const inPlan = PRESETS[plan].includes(m.key);
                return (
                  <li key={m.key} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-gray-900">
                        {m.name}
                        {isOn && !inPlan && <Badge variant="purple">Add-on</Badge>}
                        {!isOn && inPlan && <Badge variant="yellow">Off</Badge>}
                      </p>
                      <p className="text-xs text-gray-500">{m.help}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn}
                      aria-label={m.name}
                      disabled={saving === m.key}
                      onClick={() => toggle(m.key, !isOn)}
                      className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${isOn ? 'bg-teal' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isOn ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
