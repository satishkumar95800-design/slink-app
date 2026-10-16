import { ForbiddenException, HttpException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { todayIn } from '../attendance/attendance-dates';

export type Db = PrismaService | Prisma.TransactionClient;

/** Admin, accounts and (as an admin equivalent, per the finance convention) super_admin manage HR. */
export const isManager = (role: Role) =>
  role === Role.admin || role === Role.accounts || role === Role.super_admin;

/** Only admin-level users approve and lock payroll. */
export const isApprover = (role: Role) =>
  role === Role.admin || role === Role.super_admin;

export const fail = (
  Exc: new (body: { code: string; message: string }) => HttpException,
  code: string,
  message: string,
): never => {
  throw new Exc({ code, message });
};

export const forbid = (code: string, message: string): never =>
  fail(ForbiddenException, code, message);

/** Spreadsheet formula injection guard for exported text. */
export const csvCell = (value: string | number | null | undefined): string => {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const csvLine = (cells: (string | number | null | undefined)[]) =>
  cells.map(csvCell).join(',');

export function audit(
  db: Db,
  tenantId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  diff: Prisma.InputJsonValue,
) {
  return db.auditLog.create({
    data: { tenantId, actorId, action, entityType, entityId, diff },
  });
}

/**
 * Serialises writes of one kind per school (pay-run generation, employee codes,
 * state changes) with a transaction-scoped advisory lock. [scope] separates
 * independent areas so they do not block each other.
 */
export function withLock<T>(
  prisma: PrismaService,
  tenantId: string,
  scope: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hrms:${scope}:${tenantId}`}))`;
    return fn(tx);
  });
}

export async function todayFor(prisma: PrismaService, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  return todayIn(tenant?.timezone || 'Asia/Kolkata');
}
