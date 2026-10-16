import {
  leaveBalance,
  leaveSpan,
  leaveYearOf,
  previousLeaveYear,
} from './leave.math';

describe('leaveSpan', () => {
  it('counts only working days (weekly off and holidays are free)', () => {
    // Mon 2026-03-02 .. Mon 2026-03-09: Sunday the 8th is off, 5th is a holiday
    const s = leaveSpan(
      '2026-03-02',
      '2026-03-09',
      false,
      [0],
      new Set(['2026-03-05']),
    );
    expect(s.tenths).toBe(60);
    expect(s.dates).not.toContain('2026-03-08');
    expect(s.dates).not.toContain('2026-03-05');
  });
  it('a half day is 0.5 on a working day, nothing on a day off', () => {
    expect(
      leaveSpan('2026-03-02', '2026-03-02', true, [0], new Set()).tenths,
    ).toBe(5);
    expect(
      leaveSpan('2026-03-01', '2026-03-01', true, [0], new Set()).tenths,
    ).toBe(0);
  });
});

describe('leave years', () => {
  it('April-start year', () => {
    expect(leaveYearOf('2026-03-31', 4)).toEqual({
      start: '2025-04-01',
      end: '2026-03-31',
    });
    expect(leaveYearOf('2026-04-01', 4)).toEqual({
      start: '2026-04-01',
      end: '2027-03-31',
    });
  });
  it('calendar year', () => {
    expect(leaveYearOf('2026-07-15', 1)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });
  it('previous year', () => {
    expect(
      previousLeaveYear({ start: '2026-04-01', end: '2027-03-31' }, 4),
    ).toEqual({ start: '2025-04-01', end: '2026-03-31' });
  });
});

describe('leaveBalance', () => {
  const b = (over = {}) =>
    leaveBalance({
      allowanceTenths: 120,
      carryCapTenths: 50,
      prevUsedTenths: 0,
      usedTenths: 0,
      pendingTenths: 0,
      ...over,
    });
  it('is allowance plus capped carry-forward minus use', () => {
    // 12 allowance, nothing used last year: carry min(5, 12) = 5
    expect(b().carryInTenths).toBe(50);
    expect(b().availableTenths).toBe(170);
    expect(b({ usedTenths: 30 }).availableTenths).toBe(140);
  });
  it('carries only what was left unused', () => {
    expect(b({ prevUsedTenths: 100 }).carryInTenths).toBe(20);
    expect(b({ prevUsedTenths: 200 }).carryInTenths).toBe(0);
  });
  it('holds pending requests back from available', () => {
    expect(b({ pendingTenths: 50 }).availableTenths).toBe(120);
  });
  it('carry-forward cap of 0 means no carry', () => {
    expect(b({ carryCapTenths: 0 }).carryInTenths).toBe(0);
  });
});
