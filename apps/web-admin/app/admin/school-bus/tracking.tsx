'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { formatDateTime } from '../../../lib/format';
import { Badge } from '../../../components/ui/badge';

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

/** Live bus tracking (flag `busTracking`): buses on the road. */
export function LiveBuses() {
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
