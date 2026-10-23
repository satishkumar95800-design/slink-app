import { localDayRange, zoneOffsetMs } from './reception.math';

describe('reception dates', () => {
  it('knows India is 5:30 ahead', () => {
    expect(zoneOffsetMs('Asia/Kolkata', new Date('2026-10-23T10:00:00Z'))).toBe(
      330 * 60_000,
    );
  });

  it('gives the UTC instants of a school-local day', () => {
    const r = localDayRange('2026-10-23', 'Asia/Kolkata');
    expect(r.gte.toISOString()).toBe('2026-10-22T18:30:00.000Z');
    expect(r.lt.toISOString()).toBe('2026-10-23T18:30:00.000Z');
  });

  it('works for a zone behind UTC', () => {
    const r = localDayRange('2026-07-01', 'America/New_York');
    expect(r.gte.toISOString()).toBe('2026-07-01T04:00:00.000Z');
  });
});
