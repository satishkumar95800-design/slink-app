import { ForbiddenException, Injectable } from '@nestjs/common';
import { FeeStatus, PaymentClaimStatus, Prisma, ReportStatus, ReportType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { BroadcastsService } from '../broadcasts/broadcasts.service';
import { summarise } from '../attendance/attendance.service';
import { fromDbDate, monthRange, toDbDate, todayIn } from '../attendance/attendance-dates';
import type { ActiveUser } from '../../common/types/active-user.type';

const NOTICE_SCAN_LIMIT = 100;
const HOMEWORK_SCAN_LIMIT = 20;

/**
 * Parent-app read models (docs/SPEC-improvements.md Phase 3). Every method
 * first proves the student is the caller's own child via student_parents.
 */
@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly broadcasts: BroadcastsService,
  ) {}

  /** Everything the home screen's Fee, Today and Attendance cards need, in one round trip. */
  async getHome(tenantId: string, studentId: string, user: ActiveUser) {
    const student = await this.requireOwnChild(tenantId, studentId, user);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const timeZone = tenant?.timezone || 'Asia/Kolkata';
    const today = todayIn(timeZone);

    const [fees, claims, homework, notice, attendance] = await Promise.all([
      this.feeCard(tenantId, studentId, today),
      this.prisma.paymentClaim.findMany({
        where: { tenantId, studentId, status: PaymentClaimStatus.pending },
        select: { claimedAmount: true, studentFeeId: true },
      }),
      this.todaysHomework(tenantId, studentId, today, timeZone),
      this.notices(tenantId, user.id, student.classId, 1).then((rows) => rows[0] ?? null),
      this.attendanceCard(tenantId, studentId, today),
    ]);

    const claimTotal = claims.reduce((sum, c) => sum + Number(c.claimedAmount ?? 0), 0);

    return {
      student: { id: student.id, name: student.name, class: student.class },
      today,
      fees: {
        ...fees,
        claimUnderReview: claims.length > 0 ? { count: claims.length, amount: claimTotal > 0 ? claimTotal : null } : null,
      },
      homework,
      latestNotice: notice,
      attendance,
    };
  }

  /** Notices for this child: their class's notices plus school-wide ones, newest first. */
  async getNotices(tenantId: string, studentId: string, user: ActiveUser) {
    const student = await this.requireOwnChild(tenantId, studentId, user);
    return this.notices(tenantId, user.id, student.classId, NOTICE_SCAN_LIMIT);
  }

  // ── Card builders ──────────────────────────────────────────────────────────

  /**
   * The next fee due (earliest due date with a balance) drives the card and its
   * Pay Now button; totals cover everything outstanding. Waived/paid fees never count.
   */
  private async feeCard(tenantId: string, studentId: string, today: string) {
    const rows = await this.prisma.studentFee.findMany({
      where: { tenantId, studentId, status: { notIn: [FeeStatus.paid, FeeStatus.waived] } },
      select: { id: true, amountDue: true, amountPaid: true, dueDate: true, feeStructure: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });
    const open = rows
      .map((r) => ({ ...r, outstanding: Number(r.amountDue) - Number(r.amountPaid) }))
      .filter((r) => r.outstanding > 0);
    const next = open[0];

    return {
      totalOutstanding: Math.round(open.reduce((sum, r) => sum + r.outstanding, 0) * 100) / 100,
      openCount: open.length,
      overdue: open.some((r) => fromDbDate(r.dueDate) < today),
      next: next
        ? {
            studentFeeId: next.id,
            name: next.feeStructure.name,
            outstanding: Math.round(next.outstanding * 100) / 100,
            dueDate: fromDbDate(next.dueDate),
            overdue: fromDbDate(next.dueDate) < today,
          }
        : null,
    };
  }

  /** Homework published today in the school's timezone, newest first, with fresh photo links. */
  private async todaysHomework(tenantId: string, studentId: string, today: string, timeZone: string) {
    const recent = await this.prisma.report.findMany({
      where: { tenantId, studentId, type: ReportType.homework, status: ReportStatus.published },
      select: { id: true, content: true, publishedAt: true, teacher: { select: { name: true } } },
      orderBy: { publishedAt: 'desc' },
      take: HOMEWORK_SCAN_LIMIT,
    });
    const todays = recent.filter((r) => r.publishedAt && todayIn(timeZone, r.publishedAt) === today);

    return Promise.all(
      todays.map(async (r) => {
        const content = (r.content ?? {}) as Prisma.JsonObject;
        const photoUrls = await this.reports.homeworkAttachmentUrls(tenantId, r.content);
        return {
          id: r.id,
          broadcastId: typeof content.broadcastId === 'string' ? content.broadcastId : null,
          caption: typeof content.caption === 'string' ? content.caption : '',
          teacherName: r.teacher.name,
          subject: typeof content.subject === 'string' ? content.subject : null,
          photoUrl: photoUrls[0] ?? null,
          photoUrls,
          publishedAt: r.publishedAt,
        };
      }),
    );
  }

  private async attendanceCard(tenantId: string, studentId: string, today: string) {
    const { from, to } = monthRange(today.slice(0, 7));
    const [grouped, todayRecord] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { tenantId, studentId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
        _count: { _all: true },
      }),
      this.prisma.attendanceRecord.findUnique({
        where: { tenantId_studentId_date: { tenantId, studentId, date: toDbDate(today) } },
        select: { status: true },
      }),
    ]);
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;
    const month = summarise(counts);
    return {
      month: { daysPresent: month.daysPresent, daysMarked: month.daysMarked, percentage: month.percentage },
      todayStatus: todayRecord?.status ?? null,
    };
  }

  /**
   * Notices live as the parent's own notification rows (type "notice"). Class
   * notices carry their classId; school-wide ones and older rows sent before
   * classId was recorded have none, so they show for every child.
   */
  private async notices(tenantId: string, parentId: string, classId: string, limit: number) {
    const rows = await this.prisma.notification.findMany({
      where: { tenantId, userId: parentId, data: { path: ['type'], equals: 'notice' } },
      select: {
        id: true,
        title: true,
        body: true,
        data: true,
        createdAt: true,
        broadcastId: true,
        broadcast: { select: { attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: NOTICE_SCAN_LIMIT,
    });
    // One broadcast can create duplicate rows if a parent has two children in the class — keep one per message.
    const seen = new Set<string>();
    const kept = rows
      .filter((n) => {
        const data = (n.data ?? {}) as Prisma.JsonObject;
        return typeof data.classId !== 'string' || data.classId === classId;
      })
      .filter((n) => {
        const key = `${n.title}|${n.body}|${n.createdAt.toISOString().slice(0, 16)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
    return Promise.all(
      kept.map(async (n) => ({
        id: n.id,
        broadcastId: n.broadcastId,
        title: n.title,
        body: n.body,
        createdAt: n.createdAt,
        attachments: n.broadcast ? await this.broadcasts.signAttachments(tenantId, n.broadcast.attachments) : [],
      })),
    );
  }

  private async requireOwnChild(tenantId: string, studentId: string, user: ActiveUser) {
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId, parentId: user.id, student: { tenantId } },
      select: {
        student: {
          select: { id: true, name: true, classId: true, class: { select: { id: true, name: true, section: true } } },
        },
      },
    });
    if (!link) throw new ForbiddenException('You can only view your own children');
    return link.student;
  }
}
