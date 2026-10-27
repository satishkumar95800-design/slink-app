import {
  addMonths,
  monthsBetween,
  outstandingPaise,
  royaltyDue,
  statement,
  Term,
  termFor,
} from './royalty.math';

const pct = (
  percent: number,
  from: string,
  minimumPaise: number | null = null,
): Term => ({
  mode: 'percent',
  percent,
  fixedPaise: null,
  minimumPaise,
  effectiveFrom: from,
});
const fixed = (fixedPaise: number, from: string): Term => ({
  mode: 'fixed',
  percent: null,
  fixedPaise,
  minimumPaise: null,
  effectiveFrom: from,
});

describe('royalty maths', () => {
  it('steps months across years', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthsBetween('2026-11', '2027-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    expect(monthsBetween('2027-01', '2026-12')).toEqual([]);
  });

  it('uses the latest term that has started', () => {
    const terms = [pct(10, '2026-06'), fixed(500000, '2026-10')];
    expect(termFor(terms, '2026-05')).toBeNull();
    expect(termFor(terms, '2026-09')!.mode).toBe('percent');
    expect(termFor(terms, '2026-10')!.mode).toBe('fixed');
  });

  it('takes a share of fees collected, never below the minimum; fixed is flat', () => {
    expect(royaltyDue(pct(10, '2026-06'), 12_34_567_00)).toBe(1_23_456_70);
    expect(royaltyDue(pct(7.5, '2026-06'), 333)).toBe(25); // 24.975 paise rounds
    expect(royaltyDue(pct(10, '2026-06', 25_000_00), 1_00_000_00)).toBe(
      25_000_00,
    );
    expect(royaltyDue(fixed(15_000_00, '2026-06'), 0)).toBe(15_000_00);
    expect(royaltyDue(null, 1_00_000_00)).toBe(0);
  });

  it('builds a statement and counts only closed months as owed', () => {
    const rows = statement(
      [pct(10, '2026-09')],
      new Map([
        ['2026-09', 2_00_000_00],
        ['2026-10', 1_00_000_00],
        ['2026-11', 50_000_00],
      ]),
      new Map([['2026-09', 20_000_00]]),
      '2026-11',
    );
    expect(rows.map((r) => [r.month, r.duePaise, r.balancePaise])).toEqual([
      ['2026-09', 20_000_00, 0],
      ['2026-10', 10_000_00, 10_000_00],
      ['2026-11', 5_000_00, 5_000_00],
    ]);
    expect(outstandingPaise(rows, '2026-11')).toBe(10_000_00);
  });

  it('has no statement without terms, and goes back at most 24 months', () => {
    expect(statement([], new Map(), new Map(), '2026-11')).toEqual([]);
    const rows = statement(
      [fixed(100, '2020-01')],
      new Map(),
      new Map(),
      '2026-11',
    );
    expect(rows).toHaveLength(24);
    expect(rows[0].month).toBe('2024-12');
  });
});
