import { fromDbDate, toDbDate } from '../attendance/attendance-dates';

/** 0 = Sunday .. 6 = Saturday for a YYYY-MM-DD calendar day. */
export function weekday(ymd: string): number {
  return toDbDate(ymd).getUTCDay();
}

/** Every YYYY-MM-DD from [from] to [to], inclusive. Empty when from > to. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  const end = toDbDate(to).getTime();
  for (let t = toDbDate(from).getTime(); t <= end; t += 86_400_000) {
    out.push(fromDbDate(new Date(t)));
  }
  return out;
}

export function addDays(ymd: string, n: number): string {
  return fromDbDate(new Date(toDbDate(ymd).getTime() + n * 86_400_000));
}

export const isMonth = (m: string): boolean =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-03" -> first and last day. */
export function monthBounds(month: string): { from: string; to: string } {
  return {
    from: `${month}-01`,
    to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}`,
  };
}

export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
