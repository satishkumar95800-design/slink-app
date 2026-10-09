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
  async getFeePending(
    tenantId: string,
    user: ActiveUser,
    query: InsightsQueryDto,
  ) {
    const isCsv = query.format === 'csv';
    const result = await this.studentFeesService.getOutstanding(
      tenantId,
      user,
      {
        studentId: query.studentId,
        classId: query.classId,
        academicYear: query.academicYear,
        page: isCsv ? 1 : query.page,
        limit: isCsv ? CSV_EXPORT_ROW_CAP : query.limit,
      },
    );
    return result;
  }

  /** "Paid fee history" — reuses ReceiptsService.findAll's role-scoped query. */
  async getPaidHistory(
    tenantId: string,
    user: ActiveUser,
    query: InsightsQueryDto,
  ) {
    const isCsv = query.format === 'csv';
    return this.receiptsService.findAll(tenantId, user, {
      studentId: query.studentId,
      classId: query.classId,
      method: query.method,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      discountTypeId: query.discountTypeId,
      page: isCsv ? 1 : query.page,
      limit: isCsv ? CSV_EXPORT_ROW_CAP : query.limit,
    });
  }

  /** Overdue fees, sorted by due date — a variant of "fee pending" filtered further. */
  async getDefaulters(
    tenantId: string,
    user: ActiveUser,
    query: InsightsQueryDto,
  ) {
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
  async getClassCollectionSummary(
    tenantId: string,
    user: ActiveUser,
    query: InsightsQueryDto,
  ) {
    let classIds: string[];
    if (query.classId) {
      classIds = [query.classId];
    } else {
      const classes = await this.prisma.class.findMany({
        where: {
          tenantId,
          ...(query.academicYear ? { academicYear: query.academicYear } : {}),
        },
        select: { id: true },
      });
      classIds = classes.map((c) => c.id);
    }

    if (user.role === Role.teacher) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teachers: { some: { teacherId: user.id } } },
        select: { id: true },
      });
      const allowed = new Set(teacherClasses.map((c) => c.id));
      classIds = classIds.filter((id) => allowed.has(id));
    }

    if (classIds.length === 0) {
      return { data: [] };
    }

    const receiptWhere: Prisma.ReceiptWhereInput = {
      tenantId,
      classId: { in: classIds },
    };
    if (query.dateFrom || query.dateTo) {
      receiptWhere.paidOn = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [collectedGroups, classInfo] = await Promise.all([
      this.prisma.receipt.groupBy({
        by: ['classId'],
        where: receiptWhere,
        _sum: { amount: true },
      }),
      this.prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, section: true, academicYear: true },
      }),
    ]);

    const collectedByClass = new Map(
      collectedGroups.map((g) => [
        g.classId,
        g._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );

    const data = await Promise.all(
      classInfo.map(async (cls) => {
        const expectedAgg = await this.prisma.studentFee.aggregate({
          where: {
            tenantId,
            student: { classId: cls.id },
            ...(query.academicYear
              ? { feeStructure: { academicYear: query.academicYear } }
              : {}),
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

  /**
   * Student-wise whole-year fee summary: sums amountDue/amountPaid across
   * every fee structure a student is assigned (tuition, transport, arrears,
   * ...) into one row per student, rather than the per-assignment grain
   * `student-fees`/`fee-pending` use. Admin/accounts/super_admin only —
   * the same visibility as the other whole-tenant money aggregates below.
   */
  async getStudentFeeSummary(tenantId: string, query: InsightsQueryDto) {
    const groups = await this.prisma.studentFee.groupBy({
      by: ['studentId'],
      where: {
        tenantId,
        ...(query.classId ? { student: { classId: query.classId } } : {}),
        ...(query.academicYear
          ? { feeStructure: { academicYear: query.academicYear } }
          : {}),
      },
      _sum: { amountDue: true, amountPaid: true },
    });

    if (groups.length === 0) return { data: [] };

    const students = await this.prisma.student.findMany({
      where: { id: { in: groups.map((g) => g.studentId) } },
      select: {
        id: true,
        name: true,
        admissionNo: true,
        class: { select: { id: true, name: true, section: true } },
      },
    });
    const studentById = new Map(students.map((s) => [s.id, s]));

    const data = groups
      .map((g) => {
        const student = studentById.get(g.studentId);
        if (!student) return null;
        const totalDue = g._sum.amountDue ?? new Prisma.Decimal(0);
        const totalCollected = g._sum.amountPaid ?? new Prisma.Decimal(0);
        return {
          studentId: student.id,
          studentName: student.name,
          admissionNo: student.admissionNo,
          class: student.class,
          totalDue,
          totalCollected,
          outstanding: Prisma.Decimal.max(totalDue.sub(totalCollected), 0),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

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

  /**
   * Addendum 4 / A11 — "Collection Forecast" widget: last 3 completed calendar
   * months' actual collection (from Receipt, already used by every other
   * report here) plus a simple moving-average projection for next month.
   * Starts with the simpler blended total per the addendum's own guidance —
   * no per-fee-component breakdown yet. Computed on request rather than
   * cached/nightly: a school's receipt volume is small enough that this
   * three-month aggregate is cheap on every dashboard load.
   */
  /**
   * Admin dashboard fee cards, in rupees, for the school's current academic
   * year. There is no explicit "current year" setting, so it's the newest
   * academicYear label ("YYYY-YY", sorts lexically) among the school's fee
   * structures. Collected/outstanding come from the same student_fees rows the
   * Student Fees and Fee Reports screens sum, so the numbers match exactly.
   * Outstanding is summed per assignment (an overpaid row can't offset another
   * student's balance) and excludes waived fees, like StudentFeesService.getOutstanding.
   */
  async getFeeTotals(tenantId: string) {
    const latest = await this.prisma.feeStructure.findFirst({
      where: { tenantId },
      orderBy: { academicYear: 'desc' },
      select: { academicYear: true },
    });
    if (!latest) return { academicYear: null, collected: 0, outstanding: 0 };

    const [row] = await this.prisma.$queryRaw<
      { collected: Prisma.Decimal | null; outstanding: Prisma.Decimal | null }[]
    >`
      SELECT
        SUM(sf.amount_paid) AS collected,
        SUM(GREATEST(sf.amount_due - sf.amount_paid, 0)) FILTER (WHERE sf.status <> 'waived') AS outstanding
      FROM student_fees sf
      JOIN fee_structures fs ON fs.id = sf.fee_structure_id
      WHERE sf.tenant_id = ${tenantId}::uuid
        AND fs.tenant_id = ${tenantId}::uuid
        AND fs.academic_year = ${latest.academicYear}
    `;
    return {
      academicYear: latest.academicYear,
      collected: Number(row?.collected ?? 0),
      outstanding: Number(row?.outstanding ?? 0),
    };
  }

  async getCollectionForecast(tenantId: string) {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStarts = [3, 2, 1].map(
      (monthsAgo) => new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1),
    );
    const startOfWindow = monthStarts[0];

    const rows = await this.prisma.$queryRaw<
      { month: Date; total: Prisma.Decimal }[]
    >`
      SELECT date_trunc('month', paid_on) AS month, SUM(amount) AS total
      FROM receipts
      WHERE tenant_id = ${tenantId}::uuid
        AND paid_on >= ${startOfWindow}
        AND paid_on < ${startOfCurrentMonth}
      GROUP BY month
    `;
    const actualByMonth = new Map(
      rows.map((r) => [r.month.toISOString().slice(0, 7), Number(r.total)]),
    );

    const months = monthStarts.map((d) => {
      const key = d.toISOString().slice(0, 7);
      return { month: key, actual: actualByMonth.get(key) ?? 0 };
    });
    const projectedNextMonth =
      months.reduce((sum, m) => sum + m.actual, 0) / months.length;

    return {
      months,
      projectedNextMonth,
      label: 'Projected, based on the last 3 months — not a guarantee',
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
      } else if (
        typeof value === 'object' &&
        typeof (value as { toFixed?: unknown }).toFixed === 'function'
      ) {
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
