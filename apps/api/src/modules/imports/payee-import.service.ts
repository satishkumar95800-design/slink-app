import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { WorkbookParserService } from './workbook-parser.service';
import {
  GROUND_STAFF_TAB,
  PAYEE_IMPORT_MAX_ROWS,
  PAYEE_TAB_HEADERS,
  VENDORS_TAB,
} from './payee-tab-schema';
import type {
  PayeeCommitResult,
  PayeeValidationReport,
  ValidPayeeRow,
} from './payee-import.types';
import { validatePayeeTabs } from './validators/payees.validator';
import type { ParsedTab } from './types';

const TRANSACTION_TIMEOUT_MS = 30_000;

/**
 * Bulk-adds vendors and ground staff to the petty-cash payee registry. Callers
 * (the controller) have already checked the `pettyCash` flag. Stateless like the
 * onboarding import: commit re-parses and re-validates the uploaded file, and writes
 * all rows in one transaction or none.
 */
@Injectable()
export class PayeeImportService {
  constructor(
    private readonly parser: WorkbookParserService,
    private readonly prisma: PrismaService,
  ) {}

  async validate(
    tenantId: string,
    buffer: Buffer,
  ): Promise<PayeeValidationReport> {
    const tabs = await this.read(buffer);
    const existing = await this.loadExisting(this.prisma, tenantId);
    return validatePayeeTabs(tabs.groundStaff, tabs.vendors, existing).report;
  }

  async commit(
    tenantId: string,
    user: ActiveUser,
    buffer: Buffer,
  ): Promise<PayeeCommitResult> {
    const tabs = await this.read(buffer);

    return this.prisma.$transaction(
      async (tx) => {
        // One import per school at a time, so two uploads of the same file
        // cannot both pass the duplicate check and double-insert.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payee-import:${tenantId}`}))`;
        const existing = await this.loadExisting(tx, tenantId);
        const { report, toCreate, skipped } = validatePayeeTabs(
          tabs.groundStaff,
          tabs.vendors,
          existing,
        );
        if (report.totalErrors > 0)
          throw new UnprocessableEntityException(report);

        for (const r of toCreate) {
          const row = await tx.pettyCashPayee.create({
            data: {
              tenantId,
              type: r.type,
              name: r.name,
              phone: r.phone ?? null,
              notes: r.notes ?? null,
              isActive: true,
            },
          });
          // Same audit entry the payee-create endpoint writes
          await tx.auditLog.create({
            data: {
              tenantId,
              actorId: user.id,
              action: 'petty_cash.payee.create',
              entityType: 'petty_cash_payee',
              entityId: row.id,
              diff: { type: row.type, name: row.name, via: 'import' },
            },
          });
        }

        const count = (rows: ValidPayeeRow[], type: ValidPayeeRow['type']) =>
          rows.filter((r) => r.type === type).length;
        const summary = {
          groundStaff: {
            created: count(toCreate, 'GROUND_STAFF'),
            skipped: count(skipped, 'GROUND_STAFF'),
          },
          vendors: {
            created: count(toCreate, 'VENDOR'),
            skipped: count(skipped, 'VENDOR'),
          },
        };
        await tx.auditLog.create({
          data: {
            tenantId,
            actorId: user.id,
            action: 'petty_cash.payee.import',
            entityType: 'petty_cash_payee',
            entityId: null,
            diff: summary,
          },
        });
        return { status: 'completed' as const, summary };
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  private async read(
    buffer: Buffer,
  ): Promise<{ groundStaff: ParsedTab; vendors: ParsedTab }> {
    const parsed = await this.parser.parseTabs(buffer, [
      { name: GROUND_STAFF_TAB, headers: PAYEE_TAB_HEADERS[GROUND_STAFF_TAB] },
      { name: VENDORS_TAB, headers: PAYEE_TAB_HEADERS[VENDORS_TAB] },
    ]);
    const groundStaff = parsed[GROUND_STAFF_TAB];
    const vendors = parsed[VENDORS_TAB];
    const total = groundStaff.rows.length + vendors.rows.length;
    if (total === 0)
      throw new BadRequestException({
        code: 'IMPORT_EMPTY',
        message: 'The file has no rows to import',
      });
    if (total > PAYEE_IMPORT_MAX_ROWS)
      throw new BadRequestException({
        code: 'IMPORT_TOO_MANY',
        message: `A file can have at most ${PAYEE_IMPORT_MAX_ROWS} rows; split it into smaller files`,
      });
    return { groundStaff, vendors };
  }

  private loadExisting(
    db: PrismaService | Prisma.TransactionClient,
    tenantId: string,
  ) {
    return db.pettyCashPayee.findMany({
      where: { tenantId },
      select: { type: true, name: true, phone: true, isActive: true },
    });
  }
}
