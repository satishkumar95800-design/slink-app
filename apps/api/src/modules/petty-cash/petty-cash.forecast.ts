/**
 * Petty cash forecast and savings rules: deterministic, no model calls. Pure
 * functions over a snapshot so every rule is easy to test and explain. Money is
 * integer paise inside; the result carries rupee numbers for display only.
 */
import { advicePeriod, findingTemplates } from './petty-cash.strings';
import { formatRupees } from '../../common/format';

export const MIN_MONTHS = 3;
export const SEASONALITY_MIN_MONTHS = 12;
const WINDOW_MONTHS = 6;
const SEASON_CLAMP: [number, number] = [0.5, 2];

export const TREND_MIN_GROWTH = 0.25;
export const TREND_MIN_MONTHLY_PAISE = 100_000; // ignore categories under Rs 1,000 a month
export const OUTLIER_MIN_ENTRIES = 5;
export const OUTLIER_MULTIPLE = 3;
export const OUTLIER_MIN_EXCESS_PAISE = 50_000;
export const OUTLIER_LOOKBACK_DAYS = 90;
export const SMALL_PURCHASE_PAISE = 50_000;
export const SMALL_PURCHASE_MIN_PER_MONTH = 8;
export const LATE_MIN_ADVANCES = 3;
export const LATE_MIN_LATE = 2;
export const LATE_MIN_SHARE = 0.5;
const TOP_UP_ROUNDING_PAISE = 10_000; // round suggestions up to the next Rs 100

export interface ForecastExpense {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  amountPaise: number;
  categoryId: string | null;
}

export interface ForecastCategory {
  id: string;
  name: string;
  budgetPaise: number | null;
}

export interface ForecastAdvance {
  id: string;
  recipientKey: string;
  recipientName: string;
  date: string;
  amountPaise: number;
  outstandingPaise: number;
  /** Date of the last approved settlement, null if none. */
  lastSettledDate: string | null;
}

export interface ForecastInput {
  today: string;
  balancePaise: number;
  categories: ForecastCategory[];
  monthlyBudgetPaise: number | null;
  expenses: ForecastExpense[];
  advances: ForecastAdvance[];
  overdueDays: number;
}

export type FindingKind =
  | 'CATEGORY_TRENDING_UP'
  | 'OUTLIER_ENTRY'
  | 'REPEATED_SMALL_PURCHASES'
  | 'LATE_SETTLEMENT'
  | 'OVER_BUDGET_CATEGORY'
  | 'OVER_BUDGET_TOTAL';

export interface Finding {
  /** Stable per subject, so the UI can key on it. */
  id: string;
  kind: FindingKind;
  severity: 'info' | 'warning';
  subject: {
    type: 'category' | 'entry' | 'recipient' | 'school';
    id: string | null;
    name: string | null;
  };
  /** Rupee amounts and counts; the only numbers advice text may restate. */
  params: Record<string, number | string>;
  /** English template text, used when no AI phrasing is available. */
  text: string;
}

export interface MonthTotal {
  /** YYYY-MM */
  month: string;
  amount: number;
}

export interface ForecastLine {
  categoryId: string | null;
  name: string | null;
  expected: number;
  low: number;
  high: number;
}

export type ForecastResult =
  | { ready: false; monthsOfData: number; needed: number }
  | {
      ready: true;
      monthsOfData: number;
      needed: number;
      /** Month being forecast, YYYY-MM. */
      forecastMonth: string;
      history: MonthTotal[];
      total: ForecastLine;
      categories: ForecastLine[];
      seasonality: { applied: boolean; factor: number | null };
      currentBalance: number;
      suggestedTopUp: { expected: number; high: number };
      findings: Finding[];
    };

// ── date helpers (YYYY-MM strings, no timezone surprises) ───────────────────

const monthOf = (ymd: string) => ymd.slice(0, 7);
const monthIndex = (m: string) =>
  Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1;
const monthFromIndex = (i: number) =>
  `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
const dayNumber = (ymd: string) =>
  Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);

const rupees = (paise: number) => Math.round(paise) / 100;
const roundUp = (paise: number) =>
  Math.ceil(paise / TOP_UP_ROUNDING_PAISE) * TOP_UP_ROUNDING_PAISE;

/** Weights 1..n, newest heaviest. */
export function weightedAverage(valuesOldestFirst: number[]): number {
  if (valuesOldestFirst.length === 0) return 0;
  let num = 0;
  let den = 0;
  valuesOldestFirst.forEach((v, i) => {
    num += v * (i + 1);
    den += i + 1;
  });
  return Math.round(num / den);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Complete calendar months (before today's month) that have at least one approved expense. */
export function monthsWithData(
  expenses: ForecastExpense[],
  today: string,
): string[] {
  const current = monthOf(today);
  return [
    ...new Set(expenses.map((e) => monthOf(e.date)).filter((m) => m < current)),
  ].sort();
}

function monthlyTotals(
  expenses: ForecastExpense[],
  keyOf: (e: ForecastExpense) => string | null,
) {
  const out = new Map<string, Map<string, number>>(); // key -> month -> paise
  for (const e of expenses) {
    const key = keyOf(e);
    if (key === null) continue;
    const byMonth = out.get(key) ?? new Map<string, number>();
    const m = monthOf(e.date);
    byMonth.set(m, (byMonth.get(m) ?? 0) + e.amountPaise);
    out.set(key, byMonth);
  }
  return out;
}

const UNCATEGORISED = '__none__';

export function buildForecast(input: ForecastInput): ForecastResult {
  const { today, expenses } = input;
  const dataMonths = monthsWithData(expenses, today);
  const monthsOfData = dataMonths.length;
  if (monthsOfData < MIN_MONTHS)
    return { ready: false, monthsOfData, needed: MIN_MONTHS };

  const current = monthOf(today);
  const lastComplete = monthFromIndex(monthIndex(current) - 1);
  const firstMonth = dataMonths[0];
  const spanMonths = monthIndex(lastComplete) - monthIndex(firstMonth) + 1;
  const windowSize = Math.min(WINDOW_MONTHS, spanMonths);
  const window: string[] = Array.from({ length: windowSize }, (_, i) =>
    monthFromIndex(monthIndex(lastComplete) - windowSize + 1 + i),
  );

  const complete = expenses.filter((e) => monthOf(e.date) < current);
  const totals =
    monthlyTotals(complete, () => 'all').get('all') ??
    new Map<string, number>();
  const byCat = monthlyTotals(complete, (e) => e.categoryId ?? UNCATEGORISED);

  const line = (
    byMonth: Map<string, number>,
  ): { expected: number; low: number; high: number } => {
    const values = window.map((m) => byMonth.get(m) ?? 0);
    return {
      expected: weightedAverage(values),
      low: Math.min(...values),
      high: Math.max(...values),
    };
  };

  // Seasonality: only with a full year of history.
  const forecastMonth = monthFromIndex(monthIndex(current) + 1);
  let factor = 1;
  let seasonalityApplied = false;
  if (spanMonths >= SEASONALITY_MIN_MONTHS) {
    const all: string[] = Array.from({ length: spanMonths }, (_, i) =>
      monthFromIndex(monthIndex(firstMonth) + i),
    );
    const mean = all.reduce((s, m) => s + (totals.get(m) ?? 0), 0) / all.length;
    const calAvg = (mm: string) => {
      const ms = all.filter((m) => m.slice(5) === mm);
      return ms.length
        ? ms.reduce((s, m) => s + (totals.get(m) ?? 0), 0) / ms.length
        : null;
    };
    const idx = (mm: string) => {
      const a = calAvg(mm);
      return a === null || mean === 0 ? null : a / mean;
    };
    const target = idx(forecastMonth.slice(5));
    const windowIdx = window
      .map((m) => idx(m.slice(5)))
      .filter((v): v is number => v !== null);
    if (target !== null && windowIdx.length > 0) {
      const base = windowIdx.reduce((s, v) => s + v, 0) / windowIdx.length;
      if (base > 0) {
        factor = Math.min(
          SEASON_CLAMP[1],
          Math.max(SEASON_CLAMP[0], target / base),
        );
        seasonalityApplied = true;
      }
    }
  }
  const adjust = (l: { expected: number; low: number; high: number }) => ({
    expected: Math.round(l.expected * factor),
    low: Math.round(l.low * factor),
    high: Math.round(l.high * factor),
  });

  const nameOf = new Map(input.categories.map((c) => [c.id, c.name]));
  const totalLine = adjust(line(totals));
  const categories: ForecastLine[] = [...byCat.entries()]
    .map(([key, byMonth]) => ({ key, ...adjust(line(byMonth)) }))
    .filter((l) => l.expected > 0 || l.high > 0)
    .sort((a, b) => b.expected - a.expected)
    .map((l) => ({
      categoryId: l.key === UNCATEGORISED ? null : l.key,
      name: l.key === UNCATEGORISED ? null : (nameOf.get(l.key) ?? null),
      expected: rupees(l.expected),
      low: rupees(l.low),
      high: rupees(l.high),
    }));

  const findings = [
    ...trendingUp(complete, input.categories, window, byCat, dataMonths.length),
    ...outliers(expenses, input.categories, today),
    ...repeatedSmall(complete, input.categories, window),
    ...lateSettlements(input.advances, input.overdueDays, today),
    ...overBudget(input, expenses, totals, byCat, current, lastComplete),
  ];

  return {
    ready: true,
    monthsOfData,
    needed: MIN_MONTHS,
    forecastMonth,
    history: window.map((m) => ({
      month: m,
      amount: rupees(totals.get(m) ?? 0),
    })),
    total: {
      categoryId: null,
      name: null,
      expected: rupees(totalLine.expected),
      low: rupees(totalLine.low),
      high: rupees(totalLine.high),
    },
    categories,
    seasonality: {
      applied: seasonalityApplied,
      factor: seasonalityApplied ? Math.round(factor * 100) / 100 : null,
    },
    currentBalance: rupees(input.balancePaise),
    suggestedTopUp: {
      expected: rupees(
        roundUp(Math.max(0, totalLine.expected - input.balancePaise)),
      ),
      high: rupees(roundUp(Math.max(0, totalLine.high - input.balancePaise))),
    },
    findings,
  };
}

// ── savings rules ───────────────────────────────────────────────────────────

function finding(
  kind: FindingKind,
  severity: Finding['severity'],
  subject: Finding['subject'],
  params: Record<string, number | string>,
  texts: Record<string, string>,
): Finding {
  const text = findingTemplates[kind].replace(
    /\{(\w+)\}/g,
    (_, k: string) => texts[k] ?? String(params[k] ?? ''),
  );
  return {
    id: `${kind}:${subject.id ?? 'school'}:${params.period ?? params.date ?? ''}`,
    kind,
    severity,
    subject,
    params,
    text,
  };
}

/** Rule 1: last three months strictly rising (3-5 months of data), or last 3 vs the 3 before (6+). */
function trendingUp(
  _complete: ForecastExpense[],
  categories: ForecastCategory[],
  window: string[],
  byCat: Map<string, Map<string, number>>,
  monthsOfData: number,
): Finding[] {
  const out: Finding[] = [];
  for (const c of categories) {
    const byMonth = byCat.get(c.id);
    if (!byMonth) continue;
    const v = window.map((m) => byMonth.get(m) ?? 0);
    const last3 = v.slice(-3);
    let recent: number;
    let earlier: number;
    if (v.length >= 6 && monthsOfData >= 6) {
      recent = last3.reduce((a, b) => a + b, 0) / 3;
      earlier = v.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    } else {
      if (!(last3[0] < last3[1] && last3[1] < last3[2])) continue;
      recent = last3[2];
      earlier = last3[0];
    }
    if (earlier <= 0 || recent < TREND_MIN_MONTHLY_PAISE) continue;
    const growth = recent / earlier - 1;
    if (growth < TREND_MIN_GROWTH) continue;
    const params = {
      recentAvg: rupees(recent),
      earlierAvg: rupees(earlier),
      growthPct: Math.round(growth * 100),
    };
    out.push(
      finding(
        'CATEGORY_TRENDING_UP',
        'info',
        { type: 'category', id: c.id, name: c.name },
        params,
        {
          category: c.name,
          recentAvg: formatRupees(params.recentAvg),
          earlierAvg: formatRupees(params.earlierAvg),
          growthPct: String(params.growthPct),
        },
      ),
    );
  }
  return out;
}

/** Rule 2: a recent entry far above its category's median. */
function outliers(
  expenses: ForecastExpense[],
  categories: ForecastCategory[],
  today: string,
): Finding[] {
  const out: Finding[] = [];
  for (const c of categories) {
    const entries = expenses.filter((e) => e.categoryId === c.id);
    if (entries.length < OUTLIER_MIN_ENTRIES) continue;
    const med = median(entries.map((e) => e.amountPaise));
    if (med <= 0) continue;
    for (const e of entries) {
      if (dayNumber(today) - dayNumber(e.date) > OUTLIER_LOOKBACK_DAYS)
        continue;
      if (
        e.amountPaise > med * OUTLIER_MULTIPLE &&
        e.amountPaise - med >= OUTLIER_MIN_EXCESS_PAISE
      ) {
        const params = {
          entryId: e.id,
          amount: rupees(e.amountPaise),
          median: rupees(med),
          multiple: Math.round((e.amountPaise / med) * 10) / 10,
          date: e.date,
        };
        out.push(
          finding(
            'OUTLIER_ENTRY',
            'warning',
            { type: 'entry', id: e.id, name: c.name },
            params,
            {
              category: c.name,
              amount: formatRupees(params.amount),
              median: formatRupees(params.median),
              multiple: String(params.multiple),
              date: e.date,
            },
          ),
        );
      }
    }
  }
  return out
    .sort((a, b) => Number(b.params.multiple) - Number(a.params.multiple))
    .slice(0, 5);
}

/** Rule 3: many small purchases a month in one category = bulk-buy candidate. */
function repeatedSmall(
  complete: ForecastExpense[],
  categories: ForecastCategory[],
  window: string[],
): Finding[] {
  const months = window.slice(-3);
  const out: Finding[] = [];
  for (const c of categories) {
    const small = complete.filter(
      (e) =>
        e.categoryId === c.id &&
        e.amountPaise <= SMALL_PURCHASE_PAISE &&
        months.includes(monthOf(e.date)),
    );
    const countPerMonth = small.length / months.length;
    if (countPerMonth < SMALL_PURCHASE_MIN_PER_MONTH) continue;
    const total = small.reduce((s, e) => s + e.amountPaise, 0);
    const params = {
      countPerMonth: Math.round(countPerMonth),
      avgSize: rupees(Math.round(total / small.length)),
      totalPerMonth: rupees(Math.round(total / months.length)),
    };
    out.push(
      finding(
        'REPEATED_SMALL_PURCHASES',
        'info',
        { type: 'category', id: c.id, name: c.name },
        params,
        {
          category: c.name,
          countPerMonth: String(params.countPerMonth),
          avgSize: formatRupees(params.avgSize),
          totalPerMonth: formatRupees(params.totalPerMonth),
        },
      ),
    );
  }
  return out;
}

/** Rule 4: people or payees who chronically settle late. */
function lateSettlements(
  advances: ForecastAdvance[],
  overdueDays: number,
  today: string,
): Finding[] {
  const groups = new Map<
    string,
    { name: string; delays: number[]; late: number; total: number }
  >();
  for (const a of advances) {
    let delay: number;
    if (a.outstandingPaise > 0) {
      delay = dayNumber(today) - dayNumber(a.date);
      if (delay <= overdueDays) continue; // still within its window: neither late nor on time yet
    } else {
      delay = a.lastSettledDate
        ? dayNumber(a.lastSettledDate) - dayNumber(a.date)
        : 0;
    }
    const g = groups.get(a.recipientKey) ?? {
      name: a.recipientName,
      delays: [],
      late: 0,
      total: 0,
    };
    g.total += 1;
    if (delay > overdueDays) {
      g.late += 1;
      g.delays.push(delay);
    }
    groups.set(a.recipientKey, g);
  }
  const out: Finding[] = [];
  for (const [key, g] of groups) {
    if (
      g.total < LATE_MIN_ADVANCES ||
      g.late < LATE_MIN_LATE ||
      g.late / g.total < LATE_MIN_SHARE
    )
      continue;
    const params = {
      lateCount: g.late,
      total: g.total,
      days: overdueDays,
      avgDelay: Math.round(
        g.delays.reduce((s, d) => s + d, 0) / g.delays.length,
      ),
    };
    out.push(
      finding(
        'LATE_SETTLEMENT',
        'warning',
        { type: 'recipient', id: key, name: g.name },
        params,
        {
          name: g.name,
          lateCount: String(g.late),
          total: String(g.total),
          days: String(overdueDays),
          avgDelay: String(params.avgDelay),
        },
      ),
    );
  }
  return out;
}

/** Rule 5: categories (and the whole school) over their monthly budget, this month so far or last month. */
function overBudget(
  input: ForecastInput,
  expenses: ForecastExpense[],
  totals: Map<string, number>,
  byCat: Map<string, Map<string, number>>,
  current: string,
  lastComplete: string,
): Finding[] {
  const out: Finding[] = [];
  const mtd = monthlyTotals(
    expenses.filter((e) => monthOf(e.date) === current),
    (e) => e.categoryId ?? UNCATEGORISED,
  );
  const mtdTotal = expenses
    .filter((e) => monthOf(e.date) === current)
    .reduce((s, e) => s + e.amountPaise, 0);
  const periods: { period: 'current' | 'last'; month: string }[] = [
    { period: 'current', month: current },
    { period: 'last', month: lastComplete },
  ];
  for (const c of input.categories) {
    if (c.budgetPaise === null) continue;
    for (const { period, month } of periods) {
      const spend =
        (period === 'current' ? mtd.get(c.id) : byCat.get(c.id))?.get(month) ??
        0;
      if (spend <= c.budgetPaise) continue;
      const params = {
        spend: rupees(spend),
        budget: rupees(c.budgetPaise),
        period,
      };
      out.push(
        finding(
          'OVER_BUDGET_CATEGORY',
          'warning',
          { type: 'category', id: c.id, name: c.name },
          params,
          {
            category: c.name,
            spend: formatRupees(params.spend),
            budget: formatRupees(params.budget),
            period: advicePeriod[period],
          },
        ),
      );
    }
  }
  if (input.monthlyBudgetPaise !== null) {
    for (const { period, month } of periods) {
      const spend = period === 'current' ? mtdTotal : (totals.get(month) ?? 0);
      if (spend <= input.monthlyBudgetPaise) continue;
      const params = {
        spend: rupees(spend),
        budget: rupees(input.monthlyBudgetPaise),
        period,
      };
      out.push(
        finding(
          'OVER_BUDGET_TOTAL',
          'warning',
          { type: 'school', id: null, name: null },
          params,
          {
            spend: formatRupees(params.spend),
            budget: formatRupees(params.budget),
            period: advicePeriod[period],
          },
        ),
      );
    }
  }
  return out;
}
