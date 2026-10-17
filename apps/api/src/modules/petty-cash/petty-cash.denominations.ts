/**
 * Notes and coins in the petty cash box (optional, `trackDenominations`).
 *
 * Counts are plain maps of rupee value -> number of notes/coins, e.g.
 * { "500": 2, "100": 3 }. An entry records the notes that went into the box
 * (`in`) and out of it (`out`): cash given out with change received back is
 * out = notes handed over, in = the change. The net of the two must equal the
 * entry's effect on the float.
 *
 * Notes in hand = the latest physical count + the in/out of every APPROVED
 * entry that took effect after it. The count is the truth for what came
 * before it, so a count is how a school starts and how it corrects drift.
 */

/** Indian notes and coins in circulation (₹2000 withdrawn in 2023). */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

const MAX_PIECES = 100_000;

export type NoteCounts = Record<string, number>;

export interface CashNotes {
  in: NoteCounts;
  out: NoteCounts;
}

/** Raised for a malformed breakdown; the service turns it into DENOMINATIONS_INVALID. */
export class DenominationError extends Error {}

/**
 * Validates and tidies one map: only known denominations, whole counts
 * 0..100000, zeros dropped.
 */
export function normalizeCounts(raw: unknown): NoteCounts {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw))
    throw new DenominationError('counts must be an object');
  const allowed = new Set(DENOMINATIONS.map(String));
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.has(key))
      throw new DenominationError(`unknown denomination ${key}`);
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_PIECES
    )
      throw new DenominationError(`bad count for ${key}`);
  }
  const out: NoteCounts = {};
  for (const d of DENOMINATIONS) {
    const n = (raw as Record<string, number>)[String(d)];
    if (n) out[String(d)] = n;
  }
  return out;
}

export function normalizeNotes(raw: unknown): CashNotes {
  if (raw === undefined || raw === null) return { in: {}, out: {} };
  if (typeof raw !== 'object' || Array.isArray(raw))
    throw new DenominationError('denominations must be an object');
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(r))
    if (key !== 'in' && key !== 'out')
      throw new DenominationError(`unknown side ${key}`);
  return { in: normalizeCounts(r.in), out: normalizeCounts(r.out) };
}

export const isEmptyCounts = (c: NoteCounts) => Object.keys(c).length === 0;

export const isEmptyNotes = (n: CashNotes) =>
  isEmptyCounts(n.in) && isEmptyCounts(n.out);

export function countsTotalPaise(c: NoteCounts): number {
  return Object.entries(c).reduce((s, [d, n]) => s + Number(d) * 100 * n, 0);
}

/** Cash into the box minus cash out of it. */
export function netPaise(n: CashNotes): number {
  return countsTotalPaise(n.in) - countsTotalPaise(n.out);
}

/** base + Σ in - Σ out, per denomination; a negative count means the records and the box disagree. */
export function applyMovements(
  base: NoteCounts,
  moves: CashNotes[],
): NoteCounts {
  const acc = new Map<string, number>(
    DENOMINATIONS.map((d) => [String(d), base[String(d)] ?? 0]),
  );
  for (const m of moves) {
    for (const [d, n] of Object.entries(m.in))
      acc.set(d, (acc.get(d) ?? 0) + n);
    for (const [d, n] of Object.entries(m.out))
      acc.set(d, (acc.get(d) ?? 0) - n);
  }
  const out: NoteCounts = {};
  for (const d of DENOMINATIONS) out[String(d)] = acc.get(String(d)) ?? 0;
  return out;
}

/** "500 x 2, 100 x 1" for the CSV export. */
export function countsText(c: NoteCounts): string {
  return DENOMINATIONS.filter((d) => c[String(d)])
    .map((d) => `${d} x ${c[String(d)]}`)
    .join(', ');
}
