/**
 * Royalty a branch owes its group (docs/SPEC-franchise.md §7). Pure: money in
 * integer paise, months as YYYY-MM. Dues are derived from terms, fees
 * collected and payments received; nothing here is stored.
 */

export type RoyaltyMode = 'percent' | 'fixed';

export interface Term {
  mode: RoyaltyMode;
  /** percent mode: share of fees collected, e.g. 10 or 7.5 */
  percent: number | null;
  /** fixed mode: amount each month */
  fixedPaise: number | null;
  /** percent mode: never less than this a month */
  minimumPaise: number | null;
  effectiveFrom: string;
}

export interface MonthRow {
  month: string;
  /** Fees the branch collected that month (receipts). */
  collectedPaise: number;
  term: Term | null;
  duePaise: number;
  receivedPaise: number;
  /** due − received (negative = paid ahead). */
  balancePaise: number;
}

/** Statements go back at most this many months. */
export const STATEMENT_MONTHS = 24;

export const isMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** Months from `from` to `to`, both included (empty when from > to). */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** The term in force for a month: the latest one effective on or before it. */
export function termFor(terms: Term[], month: string): Term | null {
  let found: Term | null = null;
  for (const t of terms)
    if (
      t.effectiveFrom <= month &&
      (!found || t.effectiveFrom >= found.effectiveFrom)
    )
      found = t;
  return found;
}

/** Royalty for one month under a term. */
export function royaltyDue(term: Term | null, collectedPaise: number): number {
  if (!term) return 0;
  if (term.mode === 'fixed') return term.fixedPaise ?? 0;
  const share = Math.round((collectedPaise * (term.percent ?? 0)) / 100);
  return Math.max(share, term.minimumPaise ?? 0);
}

/**
 * Month-by-month statement from the first term's month (at most
 * STATEMENT_MONTHS back) to `currentMonth`. The current month's due grows as
 * fees come in.
 */
export function statement(
  terms: Term[],
  collectedByMonth: Map<string, number>,
  receivedByMonth: Map<string, number>,
  currentMonth: string,
): MonthRow[] {
  if (terms.length === 0) return [];
  const first = terms.map((t) => t.effectiveFrom).sort()[0];
  const earliest = addMonths(currentMonth, -(STATEMENT_MONTHS - 1));
  return monthsBetween(first > earliest ? first : earliest, currentMonth).map(
    (month) => {
      const term = termFor(terms, month);
      const collectedPaise = collectedByMonth.get(month) ?? 0;
      const duePaise = royaltyDue(term, collectedPaise);
      const receivedPaise = receivedByMonth.get(month) ?? 0;
      return {
        month,
        collectedPaise,
        term,
        duePaise,
        receivedPaise,
        balancePaise: duePaise - receivedPaise,
      };
    },
  );
}

/** Owed for months before the current one (the current month is still open). */
export function outstandingPaise(rows: MonthRow[], currentMonth: string) {
  return rows
    .filter((r) => r.month < currentMonth)
    .reduce((t, r) => t + r.balancePaise, 0);
}
