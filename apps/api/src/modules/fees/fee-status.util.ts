import { FeeStatus, Prisma } from '@prisma/client';

/** Status of a fee or fee component from what's due, what's paid and the due date. */
export function feeStatusFor(
  amountDue: Prisma.Decimal,
  amountPaid: Prisma.Decimal,
  dueDate: Date,
  now: Date = new Date(),
): FeeStatus {
  if (amountPaid.greaterThanOrEqualTo(amountDue)) return FeeStatus.paid;
  if (dueDate < now) return FeeStatus.overdue;
  if (amountPaid.greaterThan(0)) return FeeStatus.partial;
  return FeeStatus.pending;
}
