/**
 * Shared display formatting for the console. Amounts from the API are rupees
 * (Decimal NUMERIC(12,2) columns, often serialised as strings), never paise.
 */

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const RUPEES_WITH_PAISE = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian digit grouping; paise only when non-zero. 21400 -> "₹21,400", "125000.5" -> "₹1,25,000.50". */
export function formatRupees(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (n == null || !Number.isFinite(n)) return '₹0';
  const rounded = Math.round(n * 100) / 100;
  return `₹${(Number.isInteger(rounded) ? RUPEES : RUPEES_WITH_PAISE).format(rounded)}`;
}

/** Parses an API amount (number or Decimal string) for arithmetic; invalid input becomes 0. */
export function toAmount(amount: number | string | null | undefined): number {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return n != null && Number.isFinite(n) ? n : 0;
}

const DATE_ONLY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

/** DD/MM/YYYY for a date-only API value (Prisma @db.Date, serialised as UTC midnight). */
export function formatDateOnly(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : DATE_ONLY.format(d);
}
