import { BusTripDirection } from '@prisma/client';
import {
  AVG_SPEED_MPS,
  distanceM,
  EtaStop,
  etaMinutes,
  etaTo,
  reachedStops,
  ROAD_FACTOR,
  stopsToAlert,
  tripOrder,
} from './bus-eta';

const { pickup, drop } = BusTripDirection;

// About 1.11 km per 0.01 degree of latitude.
const stop = (
  id: string,
  sortOrder: number,
  lat: number | null,
  extra: Partial<EtaStop> = {},
): EtaStop => ({
  id,
  sortOrder,
  lat,
  lng: lat == null ? null : 77.6,
  pickupTime: null,
  dropTime: null,
  ...extra,
});

const A = stop('a', 0, 12.9);
const B = stop('b', 1, 12.91);
const C = stop('c', 2, 12.92);
const STOPS = [C, A, B];

describe('distanceM', () => {
  it('measures 0.01 degree of latitude as about 1.11 km', () => {
    const d = distanceM({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.6 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});

describe('tripOrder', () => {
  it('runs pickups in stop order and drops backwards without drop times', () => {
    expect(tripOrder(STOPS, pickup).map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(tripOrder(STOPS, drop).map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('follows the timetable when every stop has a time', () => {
    const timed = [
      { ...A, dropTime: '15:30' },
      { ...B, dropTime: '15:10' },
      { ...C, dropTime: '15:20' },
    ];
    expect(tripOrder(timed, drop).map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('reachedStops', () => {
  const ordered = tripOrder(STOPS, pickup);

  it('marks a stop reached within 120 m', () => {
    expect(reachedStops(ordered, [], { lat: 12.9005, lng: 77.6 })).toEqual([
      'a',
    ]);
    expect(reachedStops(ordered, [], { lat: 12.905, lng: 77.6 })).toEqual([]);
  });

  it('marks earlier stops reached when a fix was missed', () => {
    expect(reachedStops(ordered, [], { lat: 12.92, lng: 77.6 })).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('keeps stops already reached', () => {
    expect(reachedStops(ordered, ['a'], { lat: 12.905, lng: 77.6 })).toEqual([
      'a',
    ]);
  });
});

describe('etaTo', () => {
  const ordered = tripOrder(STOPS, pickup);
  const leg = (m: number) => (m * ROAD_FACTOR) / AVG_SPEED_MPS;

  it('times the road to the next stop at town speed', () => {
    const at = { lat: 12.9, lng: 77.6 };
    const eta = etaTo(ordered, ['a'], at, 'b', pickup);
    expect(eta).toEqual({
      reached: false,
      seconds: Math.round(leg(distanceM(at, B as never))),
    });
  });

  it('adds a halt for each stop on the way', () => {
    const at = { lat: 12.9, lng: 77.6 };
    const toB = (etaTo(ordered, ['a'], at, 'b', pickup) as { seconds: number })
      .seconds;
    const toC = (etaTo(ordered, ['a'], at, 'c', pickup) as { seconds: number })
      .seconds;
    expect(toC - toB).toBeGreaterThan(60);
  });

  it('uses the timetable between stops when both have times', () => {
    const timed = tripOrder(
      [
        { ...A, pickupTime: '07:00' },
        { ...B, pickupTime: '07:10' },
        { ...C, pickupTime: '07:30' },
      ],
      pickup,
    );
    const at = { lat: 12.91, lng: 77.6 };
    expect(etaTo(timed, ['a'], at, 'c', pickup)).toEqual({
      reached: false,
      seconds: 20 * 60,
    });
  });

  it('says reached once the bus has been to the stop', () => {
    expect(etaTo(ordered, ['a'], { lat: 0, lng: 0 }, 'a', pickup)).toEqual({
      reached: true,
    });
  });

  it('gives no time when the next stop has no location', () => {
    const blind = tripOrder([stop('a', 0, null), B], pickup);
    expect(etaTo(blind, [], { lat: 12.9, lng: 77.6 }, 'b', pickup)).toBeNull();
  });

  it('gives no time for a stop that is not on the route', () => {
    expect(
      etaTo(ordered, [], { lat: 12.9, lng: 77.6 }, 'x', pickup),
    ).toBeNull();
  });
});

describe('etaMinutes', () => {
  it('rounds up and never shows 0 before arrival', () => {
    expect(etaMinutes(10)).toBe(1);
    expect(etaMinutes(61)).toBe(2);
  });
});

describe('stopsToAlert', () => {
  const ordered = tripOrder(STOPS, pickup);
  // 0.005 degree = about 555 m, 2.5 minutes by road.
  const at = { lat: 12.905, lng: 77.6 };

  it('alerts a stop with children within 5 minutes, once', () => {
    const kids = new Set(['b', 'c']);
    expect(stopsToAlert(ordered, ['a'], [], at, pickup, kids)).toEqual([
      { stopId: 'b', minutes: 3 },
    ]);
    expect(stopsToAlert(ordered, ['a'], ['b'], at, pickup, kids)).toEqual([]);
  });

  it('skips stops with no children and stops already reached', () => {
    expect(
      stopsToAlert(ordered, ['a'], [], at, pickup, new Set(['a', 'c'])),
    ).toEqual([]);
  });
});
