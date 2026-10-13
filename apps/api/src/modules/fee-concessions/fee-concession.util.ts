import { FeeStatus, Prisma } from '@prisma/client';

export interface ConcessionComponent {
  id: string;
  feeItemId: string;
  amountDue: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  status: FeeStatus;
}

/**
 * How much each component's amountDue drops for a [percentage] concession.
 * Only the unpaid balance is reduced, so money already collected is never
 * touched; waived components and other fee items (when [feeItemId] is set)
 * are left alone. Returns only components that actually change.
 */
export function concessionReductions(
  components: ConcessionComponent[],
  percentage: Prisma.Decimal,
  feeItemId: string | null,
): Map<string, Prisma.Decimal> {
  const out = new Map<string, Prisma.Decimal>();
  for (const c of components) {
    if (c.status === FeeStatus.waived) continue;
    if (feeItemId && c.feeItemId !== feeItemId) continue;
    const outstanding = c.amountDue.sub(c.amountPaid);
    if (outstanding.lessThanOrEqualTo(0)) continue;
    const reduction = outstanding.mul(percentage).div(100).toDecimalPlaces(2);
    if (reduction.greaterThan(0)) out.set(c.id, reduction);
  }
  return out;
}
