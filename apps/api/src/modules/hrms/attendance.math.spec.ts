import {
  DayRecord,
  computePeriod,
  dayKind,
  lopTenthsFor,
} from './attendance.math';

const rec = (
  status: DayRecord['status'],
  leavePaid: boolean | null = null,
): DayRecord => ({ status, leavePaid });
const base = {
  month: '2026-03',
  rule: 'CALENDAR' as const,
  weeklyOff: [0],
  holidays: new Set<string>(),
  records: new Map<string, DayRecord>(),
  treatUnmarkedAsAbsent: false,
  joinDate: '2020-01-01',
  exitDate: null as string | null,
};

describe('dayKind', () => {
  it('knows weekly offs and holidays (2026-03-01 is a Sunday)', () => {
    expect(dayKind('2026-03-01', [0], new Set())).toBe('WEEKLY_OFF');
    expect(dayKind('2026-03-02', [0], new Set())).toBe('WORKING');
    expect(dayKind('2026-03-02', [0], new Set(['2026-03-02']))).toBe('HOLIDAY');
  });
});

describe('lopTenthsFor', () => {
  it.each([
    ['PRESENT', null, 0],
    ['HOLIDAY', null, 0],
    ['ABSENT', null, 10],
    ['HALF_DAY', null, 5],
    ['HALF_DAY', true, 0],
    ['HALF_DAY', false, 5],
    ['ON_LEAVE', true, 0],
    ['ON_LEAVE', null, 0],
    ['ON_LEAVE', false, 10],
  ] as const)('%s (leave paid %s) -> %s', (status, paid, want) => {
    expect(lopTenthsFor(rec(status, paid))).toBe(want);
  });
});

describe('computePeriod', () => {
  it('calendar days: divisor is the days in the month', () => {
    expect(computePeriod(base).periodDays).toBe(31);
  });
  it('fixed 30 ignores month length', () => {
    expect(computePeriod({ ...base, rule: 'FIXED_30' }).periodDays).toBe(30);
  });
  it('working days excludes weekly offs and holidays', () => {
    // March 2026: 5 Sundays (1,8,15,22,29) -> 26 working days; one holiday -> 25
    expect(computePeriod({ ...base, rule: 'WORKING_DAYS' }).periodDays).toBe(
      26,
    );
    expect(
      computePeriod({
        ...base,
        rule: 'WORKING_DAYS',
        holidays: new Set(['2026-03-10']),
      }).periodDays,
    ).toBe(25);
  });
  it('sums absences, half days and unpaid leave', () => {
    const records = new Map<string, DayRecord>([
      ['2026-03-02', rec('ABSENT')],
      ['2026-03-03', rec('HALF_DAY')],
      ['2026-03-04', rec('ON_LEAVE', false)],
      ['2026-03-05', rec('ON_LEAVE', true)],
      ['2026-03-06', rec('PRESENT')],
    ]);
    expect(computePeriod({ ...base, records }).lopTenths).toBe(10 + 5 + 10);
  });
  it('counts unmarked working days, and charges them only when the school says so', () => {
    const lenient = computePeriod(base);
    expect(lenient.unmarkedDays).toBe(26);
    expect(lenient.lopTenths).toBe(0);
    const strict = computePeriod({ ...base, treatUnmarkedAsAbsent: true });
    expect(strict.lopTenths).toBe(260);
  });
  it('an absence on a school holiday costs nothing under the working-days rule', () => {
    const records = new Map([['2026-03-10', rec('ABSENT')]]);
    const r = computePeriod({
      ...base,
      rule: 'WORKING_DAYS',
      holidays: new Set(['2026-03-10']),
      records,
    });
    expect(r.lopTenths).toBe(0);
  });
  it('treats days before joining and after exit as unpaid', () => {
    expect(computePeriod({ ...base, joinDate: '2026-03-16' }).lopTenths).toBe(
      150,
    );
    expect(computePeriod({ ...base, exitDate: '2026-03-20' }).lopTenths).toBe(
      110,
    );
  });
  it('never exceeds the period', () => {
    const records = new Map<string, DayRecord>();
    for (let d = 1; d <= 31; d++)
      records.set(`2026-03-${String(d).padStart(2, '0')}`, rec('ABSENT'));
    expect(
      computePeriod({ ...base, rule: 'FIXED_30', records }).lopTenths,
    ).toBe(300);
  });
});
