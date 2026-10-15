import {
  ForecastAdvance,
  ForecastCategory,
  ForecastExpense,
  ForecastInput,
  buildForecast,
  median,
  monthsWithData,
  weightedAverage,
} from './petty-cash.forecast';

const STAT: ForecastCategory = {
  id: 'stat',
  name: 'Stationery',
  budgetPaise: null,
};
const REPAIRS: ForecastCategory = {
  id: 'rep',
  name: 'Repairs',
  budgetPaise: null,
};

let n = 0;
const exp = (
  date: string,
  rupees: number,
  categoryId: string | null = 'stat',
): ForecastExpense => ({
  id: `e${++n}`,
  date,
  amountPaise: rupees * 100,
  categoryId,
});

const input = (over: Partial<ForecastInput> = {}): ForecastInput => ({
  today: '2026-10-15',
  balancePaise: 0,
  categories: [STAT, REPAIRS],
  monthlyBudgetPaise: null,
  expenses: [],
  advances: [],
  overdueDays: 7,
  ...over,
});

/** One expense on the 5th of each given month. */
const monthly = (months: string[], rupees: number[], cat = 'stat') =>
  months.map((m, i) => exp(`${m}-05`, rupees[i], cat));

describe('petty cash forecast', () => {
  beforeEach(() => (n = 0));

  describe('readiness', () => {
    it('is not ready with fewer than 3 months of approved expenses', () => {
      const r = buildForecast(
        input({ expenses: monthly(['2026-08', '2026-09'], [1000, 1000]) }),
      );
      expect(r).toEqual({ ready: false, monthsOfData: 2, needed: 3 });
    });

    it('does not count the month in progress', () => {
      const r = buildForecast(
        input({
          expenses: monthly(['2026-08', '2026-09', '2026-10'], [1, 1, 1]),
        }),
      );
      expect(r).toEqual({ ready: false, monthsOfData: 2, needed: 3 });
    });

    it('is not ready with no history', () => {
      expect(buildForecast(input())).toEqual({
        ready: false,
        monthsOfData: 0,
        needed: 3,
      });
    });

    it('is ready at exactly 3 complete months', () => {
      const r = buildForecast(
        input({
          expenses: monthly(
            ['2026-07', '2026-08', '2026-09'],
            [1000, 1000, 1000],
          ),
        }),
      );
      expect(r.ready).toBe(true);
    });

    it('counts distinct months, not entries', () => {
      expect(
        monthsWithData(
          [exp('2026-08-01', 1), exp('2026-08-20', 1)],
          '2026-10-15',
        ),
      ).toEqual(['2026-08']);
    });
  });

  describe('baseline', () => {
    it('weights recent months more heavily', () => {
      expect(weightedAverage([100, 200, 300])).toBe(
        Math.round((100 + 400 + 900) / 6),
      );
    });

    it('computes weighted average, low and high per total and category, and a suggested top-up', () => {
      const r = buildForecast(
        input({
          balancePaise: 100000,
          expenses: monthly(
            ['2026-07', '2026-08', '2026-09'],
            [3000, 4500, 6000],
          ),
        }),
      );
      if (!r.ready) throw new Error('expected ready');
      // (3000*1 + 4500*2 + 6000*3) / 6 = 5000
      expect(r.total.expected).toBe(5000);
      expect(r.total.low).toBe(3000);
      expect(r.total.high).toBe(6000);
      expect(r.categories[0]).toMatchObject({
        categoryId: 'stat',
        expected: 5000,
        low: 3000,
        high: 6000,
      });
      expect(r.forecastMonth).toBe('2026-11');
      expect(r.currentBalance).toBe(1000);
      expect(r.suggestedTopUp).toEqual({ expected: 4000, high: 5000 });
      expect(r.seasonality).toEqual({ applied: false, factor: null });
      expect(r.history.map((h) => h.month)).toEqual([
        '2026-07',
        '2026-08',
        '2026-09',
      ]);
    });

    it('suggests no top-up when the float already covers the forecast', () => {
      const r = buildForecast(
        input({
          balancePaise: 10_000_000,
          expenses: monthly(
            ['2026-07', '2026-08', '2026-09'],
            [1000, 1000, 1000],
          ),
        }),
      );
      if (!r.ready) throw new Error('expected ready');
      expect(r.suggestedTopUp).toEqual({ expected: 0, high: 0 });
    });

    it('treats a month inside the window with no spend as zero', () => {
      const r = buildForecast(
        input({
          expenses: [
            exp('2026-05-05', 600),
            exp('2026-07-05', 600),
            exp('2026-09-05', 600),
          ],
        }),
      );
      if (!r.ready) throw new Error('expected ready');
      expect(r.history.map((h) => h.amount)).toEqual([600, 0, 600, 0, 600]);
    });
  });

  describe('seasonality', () => {
    const year = (spike: number) => {
      const months: string[] = [];
      for (let m = 10; m <= 12; m++) months.push(`2025-${m}`);
      for (let m = 1; m <= 9; m++) months.push(`2026-0${m}`);
      // flat 1000 except November (the month being forecast) which spikes
      return months.map((mm) => {
        const key = mm.replace(/^(\d{4})-(\d)$/, '$1-0$2');
        return exp(`${key}-05`, key.endsWith('-11') ? spike : 1000, 'stat');
      });
    };

    it('is not applied with fewer than 12 months of history', () => {
      const r = buildForecast(
        input({
          expenses: monthly(
            [
              '2026-03',
              '2026-04',
              '2026-05',
              '2026-06',
              '2026-07',
              '2026-08',
              '2026-09',
            ],
            [1000, 1000, 1000, 1000, 1000, 1000, 1000],
          ),
        }),
      );
      if (!r.ready) throw new Error('expected ready');
      expect(r.seasonality.applied).toBe(false);
    });

    it('scales the forecast by the target month index with 12+ months', () => {
      const r = buildForecast(input({ expenses: year(3000) }));
      if (!r.ready) throw new Error('expected ready');
      expect(r.seasonality.applied).toBe(true);
      expect(r.seasonality.factor).toBeGreaterThan(1.5);
      expect(r.total.expected).toBeGreaterThan(1500);
    });

    it('clamps extreme factors', () => {
      const r = buildForecast(input({ expenses: year(100000) }));
      if (!r.ready) throw new Error('expected ready');
      expect(r.seasonality.factor).toBeLessThanOrEqual(2);
    });
  });

  describe('savings rules', () => {
    const find = (r: ReturnType<typeof buildForecast>, kind: string) => {
      if (!r.ready) throw new Error('expected ready');
      return r.findings.filter((f) => f.kind === kind);
    };

    it('flags a category rising three months running', () => {
      const r = buildForecast(
        input({
          expenses: monthly(
            ['2026-07', '2026-08', '2026-09'],
            [2000, 2600, 3500],
          ),
        }),
      );
      const [f] = find(r, 'CATEGORY_TRENDING_UP');
      expect(f.subject.id).toBe('stat');
      expect(f.params).toMatchObject({
        recentAvg: 3500,
        earlierAvg: 2000,
        growthPct: 75,
      });
      expect(f.text).toContain('Stationery');
    });

    it('does not flag flat or tiny categories', () => {
      expect(
        find(
          buildForecast(
            input({
              expenses: monthly(
                ['2026-07', '2026-08', '2026-09'],
                [2000, 2000, 2000],
              ),
            }),
          ),
          'CATEGORY_TRENDING_UP',
        ),
      ).toHaveLength(0);
      expect(
        find(
          buildForecast(
            input({
              expenses: monthly(
                ['2026-07', '2026-08', '2026-09'],
                [100, 200, 400],
              ),
            }),
          ),
          'CATEGORY_TRENDING_UP',
        ),
      ).toHaveLength(0);
    });

    it('compares the last 3 months with the 3 before with 6+ months of data', () => {
      const r = buildForecast(
        input({
          expenses: monthly(
            ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'],
            [2000, 2500, 2000, 3000, 2800, 3200],
          ),
        }),
      );
      const [f] = find(r, 'CATEGORY_TRENDING_UP');
      expect(f.params.growthPct).toBe(
        Math.round(((3000 + 2800 + 3200) / (2000 + 2500 + 2000) - 1) * 100),
      );
    });

    it('flags an entry far above its category median', () => {
      const expenses = [
        ...monthly(['2026-07', '2026-08', '2026-09'], [400, 400, 400]),
        exp('2026-09-10', 450),
        exp('2026-09-12', 380),
        exp('2026-10-02', 5000),
      ];
      const [f] = find(buildForecast(input({ expenses })), 'OUTLIER_ENTRY');
      expect(f.params).toMatchObject({
        amount: 5000,
        median: 400,
        multiple: 12.5,
        date: '2026-10-02',
      });
    });

    it('needs at least 5 entries in the category to call an outlier', () => {
      const expenses = [
        ...monthly(['2026-07', '2026-08', '2026-09'], [400, 400, 400]),
        exp('2026-10-02', 5000),
      ];
      expect(
        find(buildForecast(input({ expenses })), 'OUTLIER_ENTRY'),
      ).toHaveLength(0);
    });

    it('ignores old outliers', () => {
      const expenses = [
        ...monthly(['2026-07', '2026-08', '2026-09'], [400, 400, 400]),
        exp('2026-02-10', 5000),
        exp('2026-03-10', 400),
        exp('2026-04-10', 400),
      ];
      expect(
        find(buildForecast(input({ expenses })), 'OUTLIER_ENTRY'),
      ).toHaveLength(0);
    });

    it('flags many repeated small purchases as a bulk-buy candidate', () => {
      const expenses: ForecastExpense[] = [];
      for (const m of ['2026-07', '2026-08', '2026-09'])
        for (let d = 1; d <= 10; d++)
          expenses.push(exp(`${m}-${String(d).padStart(2, '0')}`, 100));
      const [f] = find(
        buildForecast(input({ expenses })),
        'REPEATED_SMALL_PURCHASES',
      );
      expect(f.params).toEqual({
        countPerMonth: 10,
        avgSize: 100,
        totalPerMonth: 1000,
      });
    });

    it('does not flag a few small purchases', () => {
      const expenses = monthly(
        ['2026-07', '2026-08', '2026-09'],
        [100, 100, 100],
      );
      expect(
        find(buildForecast(input({ expenses })), 'REPEATED_SMALL_PURCHASES'),
      ).toHaveLength(0);
    });

    describe('late settlement', () => {
      const adv = (
        id: string,
        key: string,
        date: string,
        outstanding: number,
        lastSettled: string | null,
      ): ForecastAdvance => ({
        id,
        recipientKey: key,
        recipientName: key === 'u:1' ? 'Asha' : 'Ravi',
        date,
        amountPaise: 100000,
        outstandingPaise: outstanding,
        lastSettledDate: lastSettled,
      });
      const base = monthly(
        ['2026-07', '2026-08', '2026-09'],
        [1000, 1000, 1000],
      );

      it('flags a person who usually settles late', () => {
        const advances = [
          adv('a1', 'u:1', '2026-07-01', 0, '2026-07-20'), // 19 days
          adv('a2', 'u:1', '2026-08-01', 0, '2026-08-15'), // 14 days
          adv('a3', 'u:1', '2026-09-01', 0, '2026-09-03'), // on time
          adv('a4', 'u:2', '2026-09-01', 0, '2026-09-02'),
        ];
        const found = find(
          buildForecast(input({ expenses: base, advances })),
          'LATE_SETTLEMENT',
        );
        expect(found).toHaveLength(1);
        expect(found[0].params).toMatchObject({
          lateCount: 2,
          total: 3,
          days: 7,
          avgDelay: 17,
        });
        expect(found[0].subject.name).toBe('Asha');
      });

      it('counts an advance still open past the limit as late', () => {
        const advances = [
          adv('a1', 'p:1', '2026-07-01', 0, '2026-07-20'),
          adv('a2', 'p:1', '2026-08-01', 0, '2026-08-20'),
          adv('a3', 'p:1', '2026-09-01', 50000, null),
        ];
        const [f] = find(
          buildForecast(input({ expenses: base, advances })),
          'LATE_SETTLEMENT',
        );
        expect(f.params.lateCount).toBe(3);
      });

      it('ignores an open advance still within its window and needs 3 advances', () => {
        const advances = [
          adv('a1', 'u:1', '2026-07-01', 0, '2026-07-30'),
          adv('a2', 'u:1', '2026-10-12', 100000, null),
        ];
        expect(
          find(
            buildForecast(input({ expenses: base, advances })),
            'LATE_SETTLEMENT',
          ),
        ).toHaveLength(0);
      });
    });

    describe('budgets', () => {
      const budgeted: ForecastCategory = { ...STAT, budgetPaise: 300000 };

      it('flags a category over budget last month and this month so far', () => {
        const expenses = [
          ...monthly(['2026-07', '2026-08'], [2500, 2500]),
          exp('2026-09-05', 3500),
          exp('2026-10-03', 3200),
        ];
        const r = buildForecast(
          input({ categories: [budgeted, REPAIRS], expenses }),
        );
        const found = find(r, 'OVER_BUDGET_CATEGORY');
        expect(found.map((f) => f.params.period).sort()).toEqual([
          'current',
          'last',
        ]);
        expect(
          found.find((f) => f.params.period === 'last')?.params,
        ).toMatchObject({ spend: 3500, budget: 3000 });
      });

      it('stays quiet when within budget', () => {
        const r = buildForecast(
          input({
            categories: [budgeted, REPAIRS],
            expenses: monthly(
              ['2026-07', '2026-08', '2026-09'],
              [2500, 2500, 2500],
            ),
          }),
        );
        expect(find(r, 'OVER_BUDGET_CATEGORY')).toHaveLength(0);
      });

      it('flags the whole-school monthly budget', () => {
        const r = buildForecast(
          input({
            monthlyBudgetPaise: 400000,
            expenses: monthly(
              ['2026-07', '2026-08', '2026-09'],
              [3000, 3000, 4500],
            ),
          }),
        );
        const [f] = find(r, 'OVER_BUDGET_TOTAL');
        expect(f.params).toMatchObject({
          spend: 4500,
          budget: 4000,
          period: 'last',
        });
      });
    });
  });

  it('median handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBe(0);
  });
});
