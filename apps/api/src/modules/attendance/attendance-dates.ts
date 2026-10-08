/**
 * Attendance dates are calendar days in the school's timezone, stored in
 * Postgres DATE columns (Prisma hands them back as UTC midnight).
 */

/** "YYYY-MM-DD" for the current calendar day in [timeZone]. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "YYYY-MM-DD" -> Date at UTC midnight, the shape Prisma uses for @db.Date. */
export function toDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Date from a @db.Date column -> "YYYY-MM-DD". */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = toDbDate(ymd);
  return !Number.isNaN(d.getTime()) && fromDbDate(d) === ymd;
}

/** First and last day of a "YYYY-MM" month. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * Date range for an academic-year label like "2025-26". Indian schools run
 * April–March; attendance only exists from when marking starts, so a school
 * that opens in June simply has no rows for April–May.
 */
export function academicYearRange(label: string): { from: string; to: string } | null {
  const match = /^(\d{4})-\d{2}$/.exec(label);
  if (!match) return null;
  const start = Number(match[1]);
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000) + 1;
}

/** DD/MM/YYYY for user-facing text. */
export function displayDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}
