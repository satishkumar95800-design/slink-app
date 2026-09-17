import { Prisma } from '@prisma/client';
import { explodeFeeItems, type ExplodableFeeItem } from './fee-component-explosion.util';
import {
  applyDiscountsToComponents,
  type ApplicableStudentDiscount,
} from '../discounts/discount-application.util';

export interface FeeStructureForAssignment {
  academicYear: string;
  dueDate: Date;
  items: ExplodableFeeItem[];
}

/** Explodes a plan's items into periods and applies one student's discounts — the shared core of every assignment path (bulk class assign, single assign, arrears rollover). */
export function buildStudentFeeComponents(
  structure: FeeStructureForAssignment,
  discounts: ApplicableStudentDiscount[],
  transportMonthlySlabAmount?: Prisma.Decimal,
) {
  const base = explodeFeeItems(
    structure.items,
    structure.academicYear,
    structure.dueDate,
    transportMonthlySlabAmount,
  );
  return applyDiscountsToComponents(base, discounts);
}

export function sumComponentAmounts(
  components: Array<{ amountDue: Prisma.Decimal }>,
): Prisma.Decimal {
  return components.reduce((sum, c) => sum.add(c.amountDue), new Prisma.Decimal(0));
}
