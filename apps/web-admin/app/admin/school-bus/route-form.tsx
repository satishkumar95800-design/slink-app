'use client';

import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from 'lucide-react';
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
  /** "12.9716, 77.5946" or a Google Maps link; empty for none. */
  location: string;
}

export interface RouteValues {
  name: string;
  vehicleNumber: string;
  driverId: string;
  attendantId: string;
  notes: string;
  stops: StopValue[];
}

/**
 * A stop location typed or pasted: "lat, lng", or a Google Maps link with
 * "@lat,lng", "q=lat,lng" or "!3dlat!4dlng". Null when empty, 'invalid' when
 * it can't be read.
 */
export function parseLocation(text: string): { lat: number; lng: number } | null | 'invalid' {
  const v = text.trim();
  if (!v) return null;
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),
    new RegExp(String.raw`@${num},\s*${num}`),
    new RegExp(String.raw`[?&](?:q|query|ll|destination)=${num}(?:,|%2C)\s*${num}`, 'i'),
    new RegExp(String.raw`^${num}\s*[,\s]\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) return { lat, lng };
  }
  return 'invalid';
}

const showLocation = (lat: number | null, lng: number | null) => (lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '');

export const emptyRoute = (r?: Route): RouteValues => ({
  name: r?.name ?? '',
  vehicleNumber: r?.vehicleNumber ?? '',
  driverId: r?.driverId ?? '',
  attendantId: r?.attendantId ?? '',
  notes: r?.notes ?? '',
  stops: r?.stops.map((s) => ({ id: s.id, name: s.name, pickupTime: s.pickupTime ?? '', dropTime: s.dropTime ?? '', location: showLocation(s.lat, s.lng) })) ?? [],
});

export const routeValid = (v: RouteValues) =>
  v.name.trim().length > 0 && v.stops.every((s) => s.name.trim().length > 0 && parseLocation(s.location) !== 'invalid');

export const toBody = (v: RouteValues) => ({
  name: v.name.trim(),
  vehicleNumber: v.vehicleNumber.trim(),
  driverId: v.driverId,
  attendantId: v.attendantId,
  notes: v.notes.trim(),
  stops: v.stops.map((s) => {
    const at = parseLocation(s.location);
    return {
      ...(s.id ? { id: s.id } : {}),
      name: s.name.trim(),
      pickupTime: s.pickupTime,
      dropTime: s.dropTime,
      ...(at && at !== 'invalid' ? at : { lat: null, lng: null }),
    };
  }),
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
          <Button size="sm" variant="secondary" onClick={() => set({ stops: [...value.stops, { name: '', pickupTime: '', dropTime: '', location: '' }] })}>
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
                <LocationField value={s.location} onChange={(location) => setStop(i, { location })} />
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
        {value.stops.length > 0 && <p className="mt-2 text-xs text-gray-500">{t('locationHelp')}</p>}
      </div>
    </div>
  );
}

function LocationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('schoolBus');
  const at = parseLocation(value);
  return (
    <div className="w-full sm:w-64">
      <Input
        label={t('location')}
        placeholder={t('locationPlaceholder')}
        maxLength={500}
        value={value}
        error={at === 'invalid' ? t('locationInvalid') : undefined}
        onChange={(e) => onChange(e.target.value)}
        // Show a pasted link as plain coordinates.
        onBlur={() => at && at !== 'invalid' && onChange(`${at.lat.toFixed(6)}, ${at.lng.toFixed(6)}`)}
      />
      {at && at !== 'invalid' && (
        <a href={`https://www.google.com/maps?q=${at.lat},${at.lng}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
          <MapPin className="h-3.5 w-3.5" />
          {t('viewOnMap')}
        </a>
      )}
    </div>
  );
}
