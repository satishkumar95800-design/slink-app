/** Milliseconds the zone is ahead of UTC at [at] (IST: +5:30). */
export function zoneOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instants a school-local calendar day ("YYYY-MM-DD") starts and ends. */
export function localDayRange(
  ymd: string,
  timeZone: string,
): { gte: Date; lt: Date } {
  const midnightUtc = Date.parse(`${ymd}T00:00:00.000Z`);
  const offset = zoneOffsetMs(timeZone, new Date(midnightUtc));
  return {
    gte: new Date(midnightUtc - offset),
    lt: new Date(midnightUtc - offset + 86_400_000),
  };
}
