import { Injectable } from '@nestjs/common';
import { FeeStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentFeesService } from '../fees/student-fees.service';
import { ReceiptsService } from '../receipts/receipts.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { InsightsQueryDto } from './dto/insights-query.dto';

const CSV_EXPORT_ROW_CAP = 5000;

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentFeesService: StudentFeesService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  /** "Students with fee pending" — reuses StudentFeesService.getOutstanding's role-scoped query. */
  async getFeePending(tenantId: string, user: ActiveUser, query: InsightsQueryDto) {
    const isCsv = query.format === 'csv';
    const result = await this.studentFeesService.getOutstanding(tenantId, user, {
      studentId: query.studentId,
      classId: query.classId,
      academicYear: query.academicYear,
      page: isCsv ? 1 : query.page,
      limit: isCsv ? CSV_EXPORT_ROW_CAP : query.limit,
    });
    return result;
  }

  /** "Paid fee history" — reuses ReceiptsService.findAll's role-scoped query. */
  async getPaidHistory(tenantId: string, user: ActiveUser, query: InsightsQueryDto) {
    const isCsv = query.format === 'csv';
    return this.receiptsService.findAll(tenantId, user, {
      studentId: query.studentId,
      classId: query.classId,
      method: query.method,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: isCsv ? 1 : query.page,
      limit: isCsv ? CSV_EXPORT_ROW_CAP : query.limit,
    });
  }

  /** Overdue fees, sorted by due date — a variant of "fee pending" filtered further. */
  async getDefaulters(tenantId: string, user: ActiveUser, query: InsightsQueryDto) {
    const isCsv = query.format === 'csv';
    return this.studentFeesService.findAll(tenantId, user, {
      studentId: query.studentId,
      classId: query.classId,
      academicYear: query.academicYear,
      status: FeeStatus.overdue,
      page: isCsv ? 1 : query.page,
      limit: isCsv ? CSV_EXPORT_ROW_CAP : query.limit,
    });
  }

  /** Collected (Receipt) vs expected (StudentFee.amountDue) totals per class. Admin/accounts/super_admin only — enforced by the controller's @Roles. */
  async getClassCollectionSummary(tenantId: string, user: ActiveUser, query: InsightsQueryDto) {
    let classIds: string[];
    if (query.classId) {
      classIds = [query.classId];
    } else {
      const classes = await this.prisma.class.findMany({
        where: { tenantId, ...(query.academicYear ? { academicYear: query.academicYear } : {}) },
        select: { id: true },
      });
      classIds = classes.map((c) => c.id);
    }

    if (user.role === Role.teacher) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teacherId: user.id },
        select: { id: true },
      });
      const allowed = new Set(teacherClasses.map((c) => c.id));
      classIds = classIds.filter((id) => allowed.has(id));
    }

    if (classIds.length === 0) {
      return { data: [] };
    }

    const receiptWhere: Prisma.ReceiptWhereInput = { tenantId, classId: { in: classIds } };
    if (query.dateFrom || query.dateTo) {
      receiptWhere.paidOn = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [collectedGroups, classInfo] = await Promise.all([
      this.prisma.receipt.groupBy({ by: ['classId'], where: receiptWhere, _sum: { amount: true } }),
      this.prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, section: true, academicYear: true },
      }),
    ]);

    const collectedByClass = new Map(collectedGroups.map((g) => [g.classId, g._sum.amount ?? new Prisma.Decimal(0)]));

    const data = await Promise.all(
      classInfo.map(async (cls) => {
        const expectedAgg = await this.prisma.studentFee.aggregate({
          where: {
            tenantId,
            student: { classId: cls.id },
            ...(query.academicYear ? { feeStructure: { academicYear: query.academicYear } } : {}),
          },
          _sum: { amountDue: true },
        });
        const expected = expectedAgg._sum.amountDue ?? new Prisma.Decimal(0);
        const collected = collectedByClass.get(cls.id) ?? new Prisma.Decimal(0);
        return {
          classId: cls.id,
          className: cls.name,
          section: cls.section,
          academicYear: cls.academicYear,
          expected,
          collected,
          outstanding: expected.sub(collected),
        };
      }),
    );

    return { data };
  }

  /** Daily/monthly cash-collection register grouped by date and payment method. Admin/accounts/super_admin only. */
  async getCollectionRegister(tenantId: string, query: InsightsQueryDto) {
    const where: Prisma.ReceiptWhereInput = { tenantId };
    if (query.dateFrom || query.dateTo) {
      where.paidOn = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.classId) where.classId = query.classId;

    const groups = await this.prisma.receipt.groupBy({
      by: ['paidOn', 'method'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { paidOn: 'asc' },
    });

    return {
      data: groups.map((g) => ({
        date: g.paidOn,
        method: g.method,
        totalAmount: g._sum.amount ?? new Prisma.Decimal(0),
        count: g._count.id,
      })),
    };
  }

  /** Renders a flat array of plain objects as a CSV string for export downloads. */
  toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => {
      let str: string;
      if (value === null || value === undefined) {
        str = '';
      } else if (typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function') {
        str = String(value); // Prisma Decimal — stringify directly rather than JSON.stringify (which double-quotes)
      } else if (typeof value === 'object') {
        str = JSON.stringify(value);
      } else {
        str = String(value);
      }
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => escape(row[h])).join(','));
    }
    return lines.join('\n');
  }
}
