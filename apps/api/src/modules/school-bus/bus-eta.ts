import { BusTripDirection } from '@prisma/client';

/**
 * Arrival time at a stop, from the bus's latest position (pure, so it can be
 * tested). The bus goes through the stops in trip order; a stop counts as
 * reached once the bus comes within REACHED_WITHIN_M of it, and every stop
 * before it in the order is then reached too (a missed GPS fix must not leave
 * a stop "ahead" for ever). Legs between stops use the school's own timetable
 * when both stops have a time for this direction, otherwise the straight-line
 * distance times a road factor at an average town speed, plus a halt.
 */

export const REACHED_WITHIN_M = 120;
/** Straight line to road distance. */
export const ROAD_FACTOR = 1.35;
/** A school bus in town traffic, metres per second (18 km/h). */
export const AVG_SPEED_MPS = 18 / 3.6;
/** Time spent at each stop on the way. */
export const HALT_S = 60;
/** Parents of a stop get the "arriving soon" push at this many minutes. */
export const ALERT_WITHIN_MIN = 5;
/** A timetable gap longer than this is treated as a typo. */
const MAX_LEG_MIN = 90;

export interface EtaStop {
  id: string;
  sortOrder: number;
  lat: number | null;
  lng: number | null;
  pickupTime: string | null;
  dropTime: string | null;
}

export interface Point {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres. */
export function distanceM(a: Point, b: Point): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const timeOf = (s: EtaStop, direction: BusTripDirection) =>
  direction === BusTripDirection.pickup ? s.pickupTime : s.dropTime;

const minutes = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * The stops in the order this trip visits them. Stops are kept in pick-up
 * order; when every stop has a time for the direction, that time decides.
 * Without drop times the drop runs the pick-up order backwards.
 */
export function tripOrder(
  stops: EtaStop[],
  direction: BusTripDirection,
): EtaStop[] {
  const bySort = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  if (bySort.length > 0 && bySort.every((s) => timeOf(s, direction)))
    return bySort.sort(
      (a, b) =>
        minutes(timeOf(a, direction)!) - minutes(timeOf(b, direction)!) ||
        a.sortOrder - b.sortOrder,
    );
  return direction === BusTripDirection.drop ? bySort.reverse() : bySort;
}

const located = (s: EtaStop): s is EtaStop & Point =>
  s.lat != null && s.lng != null;

/**
 * The reached stops after a new position: the first not-yet-reached stop the
 * bus is now at (and everything before it in the order). Returns the ids in
 * trip order.
 */
export function reachedStops(
  ordered: EtaStop[],
  reached: readonly string[],
  at: Point,
): string[] {
  const done = new Set(reached);
  const hit = ordered.findIndex(
    (s) =>
      !done.has(s.id) && located(s) && distanceM(at, s) <= REACHED_WITHIN_M,
  );
  if (hit >= 0) for (const s of ordered.slice(0, hit + 1)) done.add(s.id);
  return ordered.filter((s) => done.has(s.id)).map((s) => s.id);
}

export type Eta = { reached: true } | { reached: false; seconds: number };

/**
 * Seconds until the bus reaches `targetId`, `{ reached: true }` once it has,
 * or null when it can't be worked out (the stop isn't on the trip, or a stop
 * on the way has neither a location nor timetable times).
 */
export function etaTo(
  ordered: EtaStop[],
  reached: readonly string[],
  at: Point,
  targetId: string,
  direction: BusTripDirection,
): Eta | null {
  const target = ordered.findIndex((s) => s.id === targetId);
  if (target < 0) return null;
  const done = new Set(reached);
  if (done.has(targetId)) return { reached: true };
  const next = ordered.findIndex((s) => !done.has(s.id));
  const first = ordered[next];
  if (next < 0 || next > target || !located(first)) return null;

  let seconds = (distanceM(at, first) * ROAD_FACTOR) / AVG_SPEED_MPS;
  for (let i = next; i < target; i++) {
    const leg = legSeconds(ordered[i], ordered[i + 1], direction);
    if (leg == null) return null;
    seconds += leg;
  }
  return { reached: false, seconds: Math.round(seconds) };
}

function legSeconds(
  from: EtaStop,
  to: EtaStop,
  direction: BusTripDirection,
): number | null {
  const a = timeOf(from, direction);
  const b = timeOf(to, direction);
  if (a && b) {
    const gap = minutes(b) - minutes(a);
    if (gap > 0 && gap <= MAX_LEG_MIN) return gap * 60;
  }
  if (located(from) && located(to))
    return (distanceM(from, to) * ROAD_FACTOR) / AVG_SPEED_MPS + HALT_S;
  return null;
}

/** Whole minutes for display, at least 1 until the bus is there. */
export function etaMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Stops whose parents should now hear "arriving in about 5 minutes": a stop
 * with children on it, not yet reached or alerted, within ALERT_WITHIN_MIN.
 */
export function stopsToAlert(
  ordered: EtaStop[],
  reached: readonly string[],
  alerted: readonly string[],
  at: Point,
  direction: BusTripDirection,
  stopsWithChildren: ReadonlySet<string>,
): { stopId: string; minutes: number }[] {
  const out: { stopId: string; minutes: number }[] = [];
  for (const s of ordered) {
    if (!stopsWithChildren.has(s.id) || alerted.includes(s.id)) continue;
    const eta = etaTo(ordered, reached, at, s.id, direction);
    if (!eta || eta.reached) continue;
    if (eta.seconds <= ALERT_WITHIN_MIN * 60)
      out.push({ stopId: s.id, minutes: etaMinutes(eta.seconds) });
  }
  return out;
}
