'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Smartphone } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { formatDateTime } from '../../../lib/format';
import { useErrorText } from '../../../lib/i18n/errors';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../components/ui/toast';

interface DriverAccess {
  id: string;
  name: string;
  phone: string | null;
  hasAppAccess: boolean;
}

interface LiveRoute {
  id: string;
  name: string;
  vehicleNumber: string | null;
  driver: { name: string; phone: string | null } | null;
  trip: {
    id: string;
    direction: 'pickup' | 'drop';
    startedAt: string;
    state: 'live' | 'stale';
    position: { lat: number; lng: number; speed: number | null; at: string } | null;
  } | null;
}

const REFRESH_MS = 15_000;

/** Live bus tracking (flag `busTracking`): buses on the road and driver app logins. */
export function Tracking() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <LiveBuses />
      <DriverLogins />
    </div>
  );
}

function LiveBuses() {
  const t = useTranslations('schoolBus');
  const [rows, setRows] = useState<LiveRoute[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      api
        .get<LiveRoute[]>('/transport/live')
        .then((r) => live && setRows(r))
        .catch(() => live && setRows((p) => p ?? []));
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, []);

  const moving = rows?.filter((r) => r.trip) ?? [];
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <Navigation className="h-4 w-4 text-teal" /> {t('liveTitle')}
      </h2>
      <p className="text-xs text-gray-500">{t('liveHint')}</p>
      {rows && moving.length === 0 && <p className="mt-4 text-sm text-gray-500">{t('noneMoving')}</p>}
      <ul className="mt-3 divide-y divide-gray-100">
        {moving.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>
              <span className="font-semibold text-gray-900">{r.name}</span>
              {r.vehicleNumber && <span className="text-gray-500"> · {r.vehicleNumber}</span>}
              <span className="block text-xs text-gray-500">
                {t(`direction.${r.trip!.direction}`)} · {r.driver?.name ?? ''} ·{' '}
                {r.trip!.position ? t('lastSeen', { time: formatDateTime(r.trip!.position.at) }) : t('waitingForGps')}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge variant={r.trip!.state === 'live' ? 'green' : 'yellow'}>{t(`tripState.${r.trip!.state}`)}</Badge>
              {r.trip!.position && (
                <a
                  className="inline-flex items-center gap-1 text-xs font-bold text-teal hover:underline"
                  href={`https://www.openstreetmap.org/?mlat=${r.trip!.position.lat}&mlon=${r.trip!.position.lng}#map=16/${r.trip!.position.lat}/${r.trip!.position.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="h-3.5 w-3.5" /> {t('openMap')}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DriverLogins() {
  const t = useTranslations('schoolBus');
  const errorText = useErrorText();
  const { toast } = useToast();
  const [rows, setRows] = useState<DriverAccess[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<DriverAccess[]>('/transport/driver-access')
      .then(setRows)
      .catch((e) => toast(errorText(e), 'error'));
  }, [errorText, toast]);
  useEffect(load, [load]);

  async function toggle(d: DriverAccess) {
    if (d.hasAppAccess && !window.confirm(t('removeAccessConfirm', { name: d.name }))) return;
    setBusy(d.id);
    try {
      if (d.hasAppAccess) await api.delete(`/transport/driver-access/${d.id}`);
      else await api.post(`/transport/driver-access/${d.id}`, {});
      toast(d.hasAppAccess ? t('accessRemoved', { name: d.name }) : t('accessGiven', { name: d.name }), 'success');
      load();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <Smartphone className="h-4 w-4 text-teal" /> {t('appAccessTitle')}
      </h2>
      <p className="text-xs text-gray-500">{t('appAccessHint')}</p>
      {rows && rows.length === 0 && <p className="mt-4 text-sm text-gray-500">{t('noGroundStaff')}</p>}
      <ul className="mt-3 divide-y divide-gray-100">
        {rows?.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 py-3 text-sm">
            <span>
              <span className="font-semibold text-gray-900">{d.name}</span>
              <span className="block text-xs text-gray-500">{d.phone ?? t('noPhone')}</span>
            </span>
            <span className="flex items-center gap-2">
              {d.hasAppAccess && <Badge variant="green">{t('canSignIn')}</Badge>}
              <Button size="sm" variant={d.hasAppAccess ? 'ghost' : 'secondary'} disabled={busy === d.id || (!d.hasAppAccess && !d.phone)} onClick={() => toggle(d)}>
                {d.hasAppAccess ? t('removeAccess') : t('giveAccess')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
