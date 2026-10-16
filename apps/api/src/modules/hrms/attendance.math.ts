import { eachDate, weekday } from './hrms-dates';

/** What a date is before any marking: a normal working day, a weekly off, or a school holiday. */
export type DayKind = 'WORKING' | 'WEEKLY_OFF' | 'HOLIDAY';

export function dayKind(
  ymd: string,
  weeklyOff: readonly number[],
  holidays: ReadonlySet<string>,
): DayKind {
  if (holidays.has(ymd)) return 'HOLIDAY';
  if (weeklyOff.includes(weekday(ymd))) return 'WEEKLY_OFF';
  return 'WORKING';
}

export type AttendanceStatus =
  'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';

/** A stored attendance row reduced to what payroll needs. */
export interface DayRecord {
  status: AttendanceStatus;
  /** null = not written by a leave request; otherwise whether that leave type is paid. */
  leavePaid: boolean | null;
}

export type WorkingDaysRule = 'CALENDAR' | 'FIXED_30' | 'WORKING_DAYS';

/** Unpaid (loss-of-pay) tenths of a day for one stored row: 10 = a full day. */
export function lopTenthsFor(rec: DayRecord): number {
  switch (rec.status) {
    case 'ABSENT':
      return 10;
    case 'HALF_DAY':
      // The leave half is paid only for a paid leave type; the absent half is always unpaid.
      return rec.leavePaid === true ? 0 : 5;
    case 'ON_LEAVE':
      // A manual ON_LEAVE (no request behind it) is treated as paid leave.
      return rec.leavePaid === false ? 10 : 0;
    default:
      return 0;
  }
}

export interface PeriodInput {
  month: string;
  rule: WorkingDaysRule;
  weeklyOff: readonly number[];
  holidays: ReadonlySet<string>;
  records: ReadonlyMap<string, DayRecord>;
  treatUnmarkedAsAbsent: boolean;
  joinDate: string;
  exitDate: string | null;
}

export interface PeriodResult {
  /** The divisor salary is prorated over. */
  periodDays: number;
  /** Unpaid tenths of days (half a day = 5), never above periodDays * 10. */
  lopTenths: number;
  /** Working days inside employment with no attendance row. */
  unmarkedDays: number;
}

/**
 * Salary period and loss-of-pay for one employee and month.
 *  - CALENDAR: divisor = days in the month; FIXED_30: always 30; WORKING_DAYS:
 *    days that are neither a weekly off nor a school holiday.
 *  - Days before joining or after exit are unpaid (they count against the divisor).
 *  - Under WORKING_DAYS only working days can cost pay; under the others,
 *    weekly offs and holidays are paid.
 */
export function computePeriod(input: PeriodInput): PeriodResult {
  const [y, m] = input.month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = eachDate(
    `${input.month}-01`,
    `${input.month}-${String(last).padStart(2, '0')}`,
  );

  const kinds = new Map(
    dates.map((d) => [d, dayKind(d, input.weeklyOff, input.holidays)]),
  );
  const workingCount = dates.filter((d) => kinds.get(d) === 'WORKING').length;
  const periodDays =
    input.rule === 'FIXED_30'
      ? 30
      : input.rule === 'WORKING_DAYS'
        ? workingCount
        : dates.length;

  let lop = 0;
  let unmarked = 0;
  for (const d of dates) {
    const kind = kinds.get(d)!;
    const counts = input.rule === 'WORKING_DAYS' ? kind === 'WORKING' : true;
    const employed =
      d >= input.joinDate && (!input.exitDate || d <= input.exitDate);
    if (!employed) {
      if (counts) lop += 10;
      continue;
    }
    const rec = input.records.get(d);
    if (rec) {
      if (counts) lop += lopTenthsFor(rec);
    } else if (kind === 'WORKING') {
      unmarked += 1;
      if (input.treatUnmarkedAsAbsent && counts) lop += 10;
    }
  }
  return {
    periodDays,
    lopTenths: Math.min(lop, periodDays * 10),
    unmarkedDays: unmarked,
  };
}
