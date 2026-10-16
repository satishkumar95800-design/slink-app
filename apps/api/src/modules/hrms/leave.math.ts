import { eachDate } from './hrms-dates';
import { dayKind } from './attendance.math';

/** Leave days are counted in tenths so half days stay integers: 1 day = 10. */

export interface LeaveSpan {
  /** Dates that count as leave (working days only). */
  dates: string[];
  tenths: number;
}

/**
 * Days a leave request consumes. Weekly offs and school holidays inside the
 * range cost nothing. A half day must be a single working day (5 tenths).
 */
export function leaveSpan(
  from: string,
  to: string,
  halfDay: boolean,
  weeklyOff: readonly number[],
  holidays: ReadonlySet<string>,
): LeaveSpan {
  const dates = eachDate(from, to).filter(
    (d) => dayKind(d, weeklyOff, holidays) === 'WORKING',
  );
  if (halfDay) return { dates, tenths: dates.length === 1 ? 5 : 0 };
  return { dates, tenths: dates.length * 10 };
}

/** Leave year [start, end] containing [ymd]; the year starts on the 1st of [startMonth]. */
export function leaveYearOf(
  ymd: string,
  startMonth: number,
): { start: string; end: string } {
  const [y, m] = ymd.split('-').map(Number);
  const startYear = m >= startMonth ? y : y - 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${startYear}-${pad(startMonth)}-01`;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endYear = startMonth === 1 ? startYear : startYear + 1;
  const endDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
  return { start, end: `${endYear}-${pad(endMonth)}-${pad(endDay)}` };
}

export function previousLeaveYear(
  year: { start: string; end: string },
  startMonth: number,
): { start: string; end: string } {
  const d = new Date(`${year.start}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return leaveYearOf(d.toISOString().slice(0, 10), startMonth);
}

export interface BalanceInput {
  allowanceTenths: number;
  carryCapTenths: number;
  /** Approved days taken in the previous leave year (its own allowance only, no chained carry). */
  prevUsedTenths: number;
  usedTenths: number;
  pendingTenths: number;
}

export interface Balance {
  allowanceTenths: number;
  carryInTenths: number;
  usedTenths: number;
  pendingTenths: number;
  availableTenths: number;
}

/**
 * Derived, never stored: allowance + carry-in - approved use, where
 * carry-in = min(cap, unused part of the previous year's allowance).
 * Pending requests are held back from "available" so two requests cannot
 * both claim the last day.
 */
export function leaveBalance(i: BalanceInput): Balance {
  const carryIn = Math.min(
    i.carryCapTenths,
    Math.max(0, i.allowanceTenths - i.prevUsedTenths),
  );
  return {
    allowanceTenths: i.allowanceTenths,
    carryInTenths: carryIn,
    usedTenths: i.usedTenths,
    pendingTenths: i.pendingTenths,
    availableTenths:
      i.allowanceTenths + carryIn - i.usedTenths - i.pendingTenths,
  };
}

export const tenthsToDays = (t: number): number => t / 10;
export const daysToTenths = (
  d: number | string | { toString(): string },
): number => Math.round(Number(d.toString()) * 10);
