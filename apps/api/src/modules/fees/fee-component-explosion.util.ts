import { BillingFrequency, Prisma } from '@prisma/client';

/**
 * Explodes a FeeItem's annual amount into one or more StudentFeeComponent
 * periods per its billingFrequency. The academic year is assumed to run
 * June (of the first year in "YYYY-YY") through May (of the second) — the
 * convention seen in real fee ledgers (June–May monthly columns).
 */
const ACADEMIC_YEAR_START_MONTH = 5; // June, 0-indexed

export interface ExplodableFeeItem {
  id: string;
  amount: Prisma.Decimal;
  billingFrequency: BillingFrequency;
  quarterMonthCounts: number[];
  isTransportFee: boolean;
}

export interface ExplodedFeeComponent {
  feeItemId: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  amountDue: Prisma.Decimal;
}

function parseAcademicYearStartYear(academicYear: string): number {
  return parseInt(academicYear.slice(0, 4), 10);
}

/** monthIndex 0 = June of startYear, 11 = May of startYear + 1 */
function monthDate(startYear: number, monthIndex: number, day: number): Date {
  const totalMonth = ACADEMIC_YEAR_START_MONTH + monthIndex;
  const year = startYear + Math.floor(totalMonth / 12);
  const month = totalMonth % 12;
  return new Date(Date.UTC(year, month, day));
}

function lastDayOfMonth(startYear: number, monthIndex: number): Date {
  const start = monthDate(startYear, monthIndex, 1);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
}

/** Splits `total` across `weights`, rounded to 2dp, with any rounding remainder absorbed by the last entry so the parts always sum exactly to `total`. */
function splitByWeight(total: Prisma.Decimal, weights: number[]): Prisma.Decimal[] {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const amounts = weights.map(
    (w) => new Prisma.Decimal(((total.toNumber() * w) / totalWeight).toFixed(2)),
  );
  const allocated = amounts.reduce((sum, a) => sum.add(a), new Prisma.Decimal(0));
  amounts[amounts.length - 1] = amounts[amounts.length - 1].add(total.sub(allocated));
  return amounts;
}

export function explodeFeeItem(
  item: ExplodableFeeItem,
  academicYear: string,
  structureDueDate: Date,
  /** A student's assigned TransportSlab.monthlyAmount — overrides item.amount when item.isTransportFee is true. */
  transportMonthlySlabAmount?: Prisma.Decimal,
): ExplodedFeeComponent[] {
  const startYear = parseAcademicYearStartYear(academicYear);
  const effectiveAnnualAmount =
    item.isTransportFee && transportMonthlySlabAmount
      ? transportMonthlySlabAmount.mul(12)
      : item.amount;

  if (item.billingFrequency === BillingFrequency.one_time) {
    return [
      {
        feeItemId: item.id,
        periodLabel: 'Full Year',
        periodStart: monthDate(startYear, 0, 1),
        periodEnd: lastDayOfMonth(startYear, 11),
        dueDate: structureDueDate,
        amountDue: effectiveAnnualAmount,
      },
    ];
  }

  if (item.billingFrequency === BillingFrequency.monthly) {
    const amounts = splitByWeight(effectiveAnnualAmount, new Array(12).fill(1));
    return amounts.map((amountDue, i) => ({
      feeItemId: item.id,
      periodLabel: monthDate(startYear, i, 1).toISOString().slice(0, 7),
      periodStart: monthDate(startYear, i, 1),
      periodEnd: lastDayOfMonth(startYear, i),
      dueDate: monthDate(startYear, i, 5),
      amountDue,
    }));
  }

  // quarterly — quarterMonthCounts is validated (sums to 12) at the DTO layer
  const counts = item.quarterMonthCounts.length > 0 ? item.quarterMonthCounts : [3, 3, 3, 3];
  const amounts = splitByWeight(effectiveAnnualAmount, counts);
  let monthCursor = 0;
  return counts.map((count, i) => {
    const periodStart = monthDate(startYear, monthCursor, 1);
    const periodEnd = lastDayOfMonth(startYear, monthCursor + count - 1);
    monthCursor += count;
    return {
      feeItemId: item.id,
      periodLabel: `Q${i + 1}`,
      periodStart,
      periodEnd,
      dueDate: periodStart,
      amountDue: amounts[i],
    };
  });
}

/** Explodes every item on a fee structure into the full set of StudentFeeComponent rows for one student-fee assignment. */
export function explodeFeeItems(
  items: ExplodableFeeItem[],
  academicYear: string,
  structureDueDate: Date,
  transportMonthlySlabAmount?: Prisma.Decimal,
): ExplodedFeeComponent[] {
  return items.flatMap((item) =>
    explodeFeeItem(item, academicYear, structureDueDate, transportMonthlySlabAmount),
  );
}
