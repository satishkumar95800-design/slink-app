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

/** Locale tag for month/weekday names in the UI language, always with digits 0–9. */
function namesLocale(language: string): string {
  return `${language}-IN-u-nu-latn`;
}

/** "Oct 2026" / "ಅಕ್ಟೋ 2026" for a "YYYY-MM" month, in the UI language. */
export function formatMonthYear(month: string, language: string): string {
  return new Intl.DateTimeFormat(namesLocale(language), { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}

/** Weekday name for 1 = Monday … 7 = Sunday, in the UI language. */
export function weekdayName(day: number, language: string, width: 'long' | 'short' = 'long'): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(namesLocale(language), { weekday: width, timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, day)),
  );
}

const DATE_IST = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** DD/MM/YYYY (India time) for a timestamp such as createdAt. */
export function formatDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : DATE_IST.format(d);
}

const DATE_TIME_IST = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

/** DD/MM/YYYY, hh:mm am (India time). */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '' : DATE_TIME_IST.format(d);
}
