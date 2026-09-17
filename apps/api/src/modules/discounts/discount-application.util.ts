import { DiscountKind, Prisma } from '@prisma/client';
import type { ExplodedFeeComponent } from '../fees/fee-component-explosion.util';

/**
 * A student's tagged discount, reduced to just the fields the pure
 * application logic needs (kept independent of the Prisma include shape
 * so this stays trivially testable).
 */
export interface ApplicableStudentDiscount {
  kind: DiscountKind;
  /** null = applies across every component on the plan; set = scoped to one FeeItem */
  feeItemId: string | null;
  percentage: Prisma.Decimal | null;
  fixedAmount: Prisma.Decimal | null;
}

function clampNonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.lessThan(0) ? new Prisma.Decimal(0) : value;
}

function applyOneDiscount<T extends ExplodedFeeComponent>(
  components: T[],
  discount: ApplicableStudentDiscount,
): T[] {
  const targets = discount.feeItemId
    ? components.filter((c) => c.feeItemId === discount.feeItemId)
    : components;
  if (targets.length === 0) return components;
  const targetSet = new Set(targets);

  if (discount.kind === DiscountKind.full_waiver) {
    return components.map((c) =>
      targetSet.has(c) ? { ...c, amountDue: new Prisma.Decimal(0) } : c,
    );
  }

  if (discount.kind === DiscountKind.percentage) {
    const pct = discount.percentage ?? new Prisma.Decimal(0);
    return components.map((c) => {
      if (!targetSet.has(c)) return c;
      const reduced = c.amountDue.sub(c.amountDue.mul(pct).div(100));
      return { ...c, amountDue: clampNonNegative(reduced).toDecimalPlaces(2) };
    });
  }

  // fixed_amount — distributed proportionally across the targeted components'
  // relative share of the outstanding amount, capped so it never exceeds it.
  const fixed = discount.fixedAmount ?? new Prisma.Decimal(0);
  const totalTargetAmount = targets.reduce((sum, c) => sum.add(c.amountDue), new Prisma.Decimal(0));
  if (totalTargetAmount.lessThanOrEqualTo(0)) return components;
  const cappedFixed = fixed.greaterThan(totalTargetAmount) ? totalTargetAmount : fixed;

  return components.map((c) => {
    if (!targetSet.has(c)) return c;
    const share = c.amountDue.div(totalTargetAmount).mul(cappedFixed);
    return { ...c, amountDue: clampNonNegative(c.amountDue.sub(share)).toDecimalPlaces(2) };
  });
}

export function applyDiscountsToComponents<T extends ExplodedFeeComponent>(
  components: T[],
  discounts: ApplicableStudentDiscount[],
): T[] {
  return discounts.reduce(applyOneDiscount, components);
}
