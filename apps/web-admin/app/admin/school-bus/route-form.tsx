'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Person, Route } from './types';

export interface StopValue {
  id?: string;
  name: string;
  pickupTime: string;
  dropTime: string;
}

export interface RouteValues {
  name: string;
  vehicleNumber: string;
  driverId: string;
  attendantId: string;
  notes: string;
  stops: StopValue[];
}

export const emptyRoute = (r?: Route): RouteValues => ({
  name: r?.name ?? '',
  vehicleNumber: r?.vehicleNumber ?? '',
  driverId: r?.driverId ?? '',
  attendantId: r?.attendantId ?? '',
  notes: r?.notes ?? '',
  stops: r?.stops.map((s) => ({ id: s.id, name: s.name, pickupTime: s.pickupTime ?? '', dropTime: s.dropTime ?? '' })) ?? [],
});

export const routeValid = (v: RouteValues) => v.name.trim().length > 0 && v.stops.every((s) => s.name.trim().length > 0);

export const toBody = (v: RouteValues) => ({
  name: v.name.trim(),
  vehicleNumber: v.vehicleNumber.trim(),
  driverId: v.driverId,
  attendantId: v.attendantId,
  notes: v.notes.trim(),
  stops: v.stops.map((s) => ({ ...(s.id ? { id: s.id } : {}), name: s.name.trim(), pickupTime: s.pickupTime, dropTime: s.dropTime })),
});

/** Route details and its stops in pick-up order. */
export function RouteFields({ value, onChange, staff }: { value: RouteValues; onChange: (v: RouteValues) => void; staff: Person[] }) {
  const t = useTranslations('schoolBus');
  const set = (patch: Partial<RouteValues>) => onChange({ ...value, ...patch });
  const setStop = (i: number, patch: Partial<StopValue>) => set({ stops: value.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, by: number) => {
    const stops = [...value.stops];
    const [s] = stops.splice(i, 1);
    stops.splice(i + by, 0, s);
    set({ stops });
  };
  const options = staff.map((p) => ({ value: p.id, label: p.phone ? t('staffOption', { name: p.name, phone: p.phone }) : p.name }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label={t('routeName')} required maxLength={80} value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('routeNamePlaceholder')} />
        <Input label={t('vehicleNumber')} maxLength={20} value={value.vehicleNumber} onChange={(e) => set({ vehicleNumber: e.target.value.toUpperCase() })} placeholder={t('vehicleNumberPlaceholder')} />
        <Select label={t('driver')} value={value.driverId} onChange={(e) => set({ driverId: e.target.value })} placeholder={t('noDriver')} options={options} />
        <Select label={t('attendant')} value={value.attendantId} onChange={(e) => set({ attendantId: e.target.value })} placeholder={t('noAttendant')} options={options} />
      </div>
      {staff.length === 0 && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('noStaffHint')}</p>}
      <Input label={t('notes')} maxLength={500} value={value.notes} onChange={(e) => set({ notes: e.target.value })} />

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">{t('stops')}</p>
          <Button size="sm" variant="secondary" onClick={() => set({ stops: [...value.stops, { name: '', pickupTime: '', dropTime: '' }] })}>
            <Plus className="h-4 w-4" />
            {t('addStop')}
          </Button>
        </div>
        {value.stops.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">{t('noStops')}</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {value.stops.map((s, i) => (
              <li key={s.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-100 bg-cream/40 p-2">
                <span className="mb-2.5 w-6 text-center text-sm font-bold text-gray-500">{i + 1}</span>
                <div className="min-w-40 flex-1">
                  <Input aria-label={t('stopName')} placeholder={t('stopName')} maxLength={100} value={s.name} onChange={(e) => setStop(i, { name: e.target.value })} />
                </div>
                <div className="w-36">
                  <Input type="time" label={t('pickup')} value={s.pickupTime} onChange={(e) => setStop(i, { pickupTime: e.target.value })} />
                </div>
                <div className="w-36">
                  <Input type="time" label={t('drop')} value={s.dropTime} onChange={(e) => setStop(i, { dropTime: e.target.value })} />
                </div>
                <div className="mb-1 flex gap-1">
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('moveUp')}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" disabled={i === value.stops.length - 1} onClick={() => move(i, 1)} aria-label={t('moveDown')}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => set({ stops: value.stops.filter((_, j) => j !== i) })} aria-label={t('removeStop')}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
