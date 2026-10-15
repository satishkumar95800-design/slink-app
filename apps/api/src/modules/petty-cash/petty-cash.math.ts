/**
 * Petty cash arithmetic. Everything is integer paise: amounts arrive from the
 * database as NUMERIC(12,2) and are converted once at the edge, so the float
 * and every advance balance are exact.
 *
 *   float = TOP_UPs - DISBURSEMENTs - direct EXPENSEs + RETURNs   (APPROVED rows only)
 *
 * An EXPENSE that settles a disbursement does not move the float (the cash
 * already left with the disbursement); a RETURN puts the unspent cash back.
 */

export type PettyType = 'TOP_UP' | 'DISBURSEMENT' | 'EXPENSE' | 'RETURN';

/** An APPROVED ledger row, reduced to what the maths needs. */
export interface LedgerRow {
  id: string;
  type: PettyType;
  amountPaise: number;
  /** YYYY-MM-DD */
  date: string;
  settlesEntryId: string | null;
  /** "u:<userId>" or "p:<payeeId>" for disbursements. */
  recipientKey: string | null;
}

export interface Advance {
  id: string;
  recipientKey: string | null;
  date: string;
  amountPaise: number;
  settledPaise: number;
  outstandingPaise: number;
  ageDays: number;
  overdue: boolean;
}

/** Decimal / "12.50" / 12.5 -> 1250. Rejects more than two decimals. */
export function toPaise(
  value: number | string | { toString(): string },
): number {
  const text = (
    typeof value === 'object' ? value.toString() : String(value)
  ).trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) throw new Error(`Not a money amount: ${text}`);
  const paise = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || '0');
  return m[1] ? -paise : paise;
}

/** 1250 -> "12.50". */
export function fromPaise(paise: number): string {
  const abs = Math.abs(paise);
  const whole = Math.trunc(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${paise < 0 ? '-' : ''}${whole}.${frac}`;
}

/** Entries strictly above the threshold wait for an admin. */
export function needsApproval(
  amountPaise: number,
  thresholdPaise: number,
): boolean {
  return amountPaise > thresholdPaise;
}

/** Whether an entry of this shape takes cash out of the float when approved. */
export function reducesFloat(
  type: PettyType,
  settlesEntryId: string | null,
): boolean {
  return type === 'DISBURSEMENT' || (type === 'EXPENSE' && !settlesEntryId);
}

/** Signed effect of one APPROVED row on the float. */
export function floatEffect(
  row: Pick<LedgerRow, 'type' | 'amountPaise' | 'settlesEntryId'>,
): number {
  if (row.type === 'TOP_UP' || row.type === 'RETURN') return row.amountPaise;
  if (reducesFloat(row.type, row.settlesEntryId)) return -row.amountPaise;
  return 0;
}

export function computeBalance(rows: LedgerRow[]): number {
  return rows.reduce((sum, r) => sum + floatEffect(r), 0);
}

const dayNumber = (ymd: string) =>
  Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

/**
 * Every approved disbursement with what has been settled (approved expenses +
 * returns that point at it). Open = outstanding > 0; overdue = open for more
 * than overdueDays.
 */
export function computeAdvances(
  rows: LedgerRow[],
  overdueDays: number,
  today: string,
): Advance[] {
  const settled = new Map<string, number>();
  for (const r of rows) {
    if ((r.type === 'EXPENSE' || r.type === 'RETURN') && r.settlesEntryId) {
      settled.set(
        r.settlesEntryId,
        (settled.get(r.settlesEntryId) ?? 0) + r.amountPaise,
      );
    }
  }
  return rows
    .filter((r) => r.type === 'DISBURSEMENT')
    .map((r) => {
      const settledPaise = settled.get(r.id) ?? 0;
      const outstandingPaise = r.amountPaise - settledPaise;
      const ageDays = daysBetween(r.date, today);
      return {
        id: r.id,
        recipientKey: r.recipientKey,
        date: r.date,
        amountPaise: r.amountPaise,
        settledPaise,
        outstandingPaise,
        ageDays,
        overdue: outstandingPaise > 0 && ageDays > overdueDays,
      };
    });
}

/** Amount still open on one disbursement, given the APPROVED rows. */
export function outstandingOn(
  disbursementId: string,
  rows: LedgerRow[],
  overdueDays = 0,
  today = '1970-01-01',
): number {
  return (
    computeAdvances(rows, overdueDays, today).find(
      (a) => a.id === disbursementId,
    )?.outstandingPaise ?? 0
  );
}
