/**
 * User-facing formatting for push/SMS text. Mirrors the web console's
 * lib/format.ts and the mobile app's core/format/money.dart.
 */

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const RUPEES_WITH_PAISE = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian digit grouping; paise only when non-zero. 21400 -> "₹21,400", 125000.5 -> "₹1,25,000.50". */
export function formatRupees(amount: number | string | { toString(): string }): string {
  const n = typeof amount === 'number' ? amount : Number(amount.toString());
  if (!Number.isFinite(n)) return '₹0';
  const rounded = Math.round(n * 100) / 100;
  return `₹${(Number.isInteger(rounded) ? RUPEES : RUPEES_WITH_PAISE).format(rounded)}`;
}

/** DD/MM/YYYY for a date-only (@db.Date, UTC midnight) value. */
export function formatDateOnly(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}
