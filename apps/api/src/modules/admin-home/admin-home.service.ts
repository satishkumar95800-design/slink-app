import { Injectable } from '@nestjs/common';
import {
  LeaveRequestStatus,
  PaymentClaimStatus,
  PettyCashStatus,
  Prisma,
} from '@prisma/client';
import { todayIn, toDbDate } from '../attendance/attendance-dates';
import { AttendanceService } from '../attendance/attendance.service';
import { fromPaise, toPaise } from '../petty-cash/petty-cash.math';
import { BusTrackingService } from '../school-bus/bus-tracking.service';
import { PrismaService } from '../../prisma/prisma.service';

const sum = (v: Prisma.Decimal | null | undefined) =>
  fromPaise(v ? toPaise(v) : 0);

/**
 * The admin's phone: today at a glance, in one call. Counts and totals only;
 * the details stay in the console. Sections for modules the school doesn't
 * have come back null so the app hides them.
 */
@Injectable()
export class AdminHomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly buses: BusTrackingService,
  ) {}

  async home(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true, features: true },
    });
    const on = (f: string) =>
      (tenant.features as Record<string, unknown> | null)?.[f] === true;
    const today = todayIn(tenant.timezone || 'Asia/Kolkata');
    const day = toDbDate(today);
    const monthStart = toDbDate(`${today.slice(0, 8)}01`);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      att,
      feesToday,
      feesMonth,
      claims,
      leave,
      petty,
      admissions,
      alerts,
      buses,
      library,
    ] = await Promise.all([
      this.attendance.getSchoolSummary(tenantId, today),
      this.prisma.receipt.aggregate({
        where: { tenantId, paidOn: day },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.receipt.aggregate({
        where: { tenantId, paidOn: { gte: monthStart, lte: day } },
        _sum: { amount: true },
      }),
      this.prisma.paymentClaim.count({
        where: { tenantId, status: PaymentClaimStatus.pending },
      }),
      on('hrms')
        ? Promise.all([
            this.prisma.leaveRequest.count({
              where: { tenantId, status: LeaveRequestStatus.PENDING },
            }),
            this.prisma.leaveRequest.count({
              where: {
                tenantId,
                status: LeaveRequestStatus.APPROVED,
                fromDate: { lte: day },
                toDate: { gte: day },
              },
            }),
          ])
        : null,
      on('pettyCash')
        ? this.prisma.pettyCashEntry.count({
            where: { tenantId, status: PettyCashStatus.PENDING },
          })
        : null,
      on('admissions')
        ? Promise.all([
            this.prisma.admissionEnquiry.count({
              where: { tenantId, createdAt: { gte: weekAgo } },
            }),
            this.prisma.admissionEnquiry.count({
              where: {
                tenantId,
                stage: { notIn: ['enrolled', 'lost'] },
                nextFollowUpOn: { lte: day },
              },
            }),
          ])
        : null,
      on('aiInsights')
        ? this.prisma.insightAlert.groupBy({
            by: ['severity'],
            where: {
              tenantId,
              status: 'open',
              audience: 'admin',
              kind: { not: 'weekly_summary' },
            },
            _count: { _all: true },
          })
        : null,
      on('transport') && on('busTracking') ? this.buses.live(tenantId) : null,
      on('library')
        ? this.prisma.libraryLoan.count({
            where: { tenantId, returnedOn: null, dueOn: { lt: day } },
          })
        : null,
    ]);

    return {
      date: today,
      attendance: {
        holiday: att.holiday?.name ?? null,
        totalStudents: att.totalStudents,
        present: att.present,
        absent: att.absent,
        late: att.late,
        leave: att.leave,
        classesNotMarked: att.notMarked.map((c) =>
          `${c.name} ${c.section ?? ''}`.trim(),
        ),
      },
      fees: {
        collectedToday: sum(feesToday._sum.amount),
        receiptsToday: feesToday._count,
        collectedThisMonth: sum(feesMonth._sum.amount),
      },
      approvals: {
        paymentClaims: claims,
        leaveRequests: leave ? leave[0] : null,
        pettyCash: petty,
      },
      staffOnLeaveToday: leave ? leave[1] : null,
      admissions: admissions
        ? { newThisWeek: admissions[0], followUpsDue: admissions[1] }
        : null,
      alerts: alerts
        ? Object.fromEntries(alerts.map((a) => [a.severity, a._count._all]))
        : null,
      buses: buses
        ? {
            routes: buses.length,
            onTheMove: buses.filter((b) => b.trip?.state === 'live').length,
            live: buses
              .filter((b) => b.trip)
              .map((b) => ({
                name: b.name,
                vehicleNumber: b.vehicleNumber,
                state: b.trip!.state,
                direction: b.trip!.direction,
              })),
          }
        : null,
      libraryOverdue: library,
    };
  }
}
