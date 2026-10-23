/** "YYYY-MM-DD" plus n calendar days. */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days past the due date on [onDay] (0 when on time). */
export function daysLate(dueOn: string, onDay: string): number {
  if (onDay <= dueOn) return 0;
  const ms =
    new Date(`${onDay}T00:00:00.000Z`).getTime() -
    new Date(`${dueOn}T00:00:00.000Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Fine in paise: every day late at the school's rate. */
export function finePaise(
  dueOn: string,
  returnedOn: string,
  perDayPaise: number,
): number {
  return daysLate(dueOn, returnedOn) * Math.max(0, perDayPaise);
}

/**
 * Next accession numbers for [count] new copies: after the highest purely
 * numeric one the school already has (accession registers are usually 1, 2, 3...).
 */
export function nextAccessionNumbers(
  existing: string[],
  count: number,
): string[] {
  const highest = existing.reduce(
    (max, a) => (/^\d+$/.test(a) ? Math.max(max, Number(a)) : max),
    0,
  );
  return Array.from({ length: count }, (_, i) => String(highest + 1 + i));
}
