import { Injectable } from '@nestjs/common';
import {
  AppointmentStatus,
  EmployeeStatus,
  LeaveRequestStatus,
  PaymentClaimStatus,
  PettyCashStatus,
  Prisma,
  Role,
  StaffAttendanceStatus,
} from '@prisma/client';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';
import { addDays, localTime, urgentItems } from './admin-home.rules';
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
    const tz = tenant.timezone || 'Asia/Kolkata';
    const today = todayIn(tz);
    const now = localTime(tz);
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

    const [teachers, events, desk] = await Promise.all([
      this.teachersToday(tenantId, on('hrms'), day),
      this.comingUp(tenantId, on('calendar'), today),
      on('admissions') ? this.deskToday(tenantId, today, now) : null,
    ]);
    const followUpsOverdue = on('admissions')
      ? await this.prisma.admissionEnquiry.count({
          where: {
            tenantId,
            stage: { notIn: ['enrolled', 'lost'] },
            nextFollowUpOn: { lt: day },
          },
        })
      : null;
    const severity = (s: string) =>
      alerts?.find((a) => a.severity === s)?._count._all ?? 0;

    return {
      date: today,
      teachers,
      events,
      appointments: desk,
      urgent: urgentItems({
        now,
        holiday: !!att.holiday,
        criticalAlerts: severity('critical'),
        busesNoSignal:
          buses?.filter((b) => b.trip?.state === 'stale').length ?? 0,
        classesNotMarked: att.notMarked.length,
        staffNotMarked: teachers?.notMarked ?? null,
        paymentClaims: claims,
        leaveRequests: leave ? leave[0] : null,
        pettyCash: petty,
        followUpsOverdue,
        appointmentsWaiting: desk?.waiting ?? null,
      }),
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

  /**
   * Teachers today from staff attendance (HR & payroll): present, absent, on
   * leave, not marked yet, and who is away. Without HR only the count.
   */
  private async teachersToday(tenantId: string, hrms: boolean, day: Date) {
    if (!hrms) {
      const total = await this.prisma.user.count({
        where: { tenantId, role: Role.teacher },
      });
      return { total, tracked: false as const };
    }
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        status: EmployeeStatus.ACTIVE,
        user: { role: Role.teacher },
      },
      select: {
        name: true,
        attendance: { where: { date: day }, select: { status: true } },
      },
      orderBy: { name: 'asc' },
    });
    const count = (st: StaffAttendanceStatus) =>
      employees.filter((e) => e.attendance[0]?.status === st).length;
    return {
      total: employees.length,
      tracked: true as const,
      present: count(StaffAttendanceStatus.PRESENT),
      halfDay: count(StaffAttendanceStatus.HALF_DAY),
      absent: count(StaffAttendanceStatus.ABSENT),
      onLeave: count(StaffAttendanceStatus.ON_LEAVE),
      notMarked: employees.filter((e) => !e.attendance[0]).length,
      /** Who is away today (absent or on leave), for the card. */
      away: employees
        .filter((e) =>
          (
            [
              StaffAttendanceStatus.ABSENT,
              StaffAttendanceStatus.ON_LEAVE,
            ] as string[]
          ).includes(e.attendance[0]?.status ?? ''),
        )
        .slice(0, 10)
        .map((e) => ({ name: e.name, status: e.attendance[0].status })),
    };
  }

  /** The next 14 days: school events and PTMs (calendar), and holidays. */
  private async comingUp(tenantId: string, calendar: boolean, today: string) {
    const until = toDbDate(addDays(today, 14));
    const from = toDbDate(today);
    const [events, holidays] = await Promise.all([
      calendar
        ? this.prisma.schoolEvent.findMany({
            where: {
              tenantId,
              OR: [
                { startDate: { gte: from, lte: until } },
                { startDate: { lt: from }, endDate: { gte: from } },
              ],
            },
            orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
            take: 8,
            select: {
              title: true,
              type: true,
              startDate: true,
              endDate: true,
              startTime: true,
            },
          })
        : [],
      this.prisma.schoolHoliday.findMany({
        where: { tenantId, date: { gte: from, lte: until } },
        orderBy: { date: 'asc' },
        take: 5,
        select: { name: true, date: true },
      }),
    ]);
    return [
      ...events.map((e) => ({
        title: e.title,
        kind: e.type === 'PTM' ? ('ptm' as const) : ('event' as const),
        date: fromDbDate(e.startDate),
        endDate: e.endDate ? fromDbDate(e.endDate) : null,
        time: e.startTime,
      })),
      ...holidays.map((h) => ({
        title: h.name,
        kind: 'holiday' as const,
        date: fromDbDate(h.date),
        endDate: null,
        time: null,
      })),
    ]
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (a.time ?? '').localeCompare(b.time ?? ''),
      )
      .slice(0, 8);
  }

  /**
   * Front desk today: appointments (interviews, meetings...), campus tours
   * booked for today, how many are due later this week, and how many are
   * past their time without arriving.
   */
  private async deskToday(tenantId: string, today: string, now: string) {
    const day = toDbDate(today);
    const [appointments, tours, later] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          date: day,
          status: { not: AppointmentStatus.cancelled },
        },
        orderBy: { time: 'asc' },
        select: {
          time: true,
          kind: true,
          name: true,
          withWhom: true,
          status: true,
        },
      }),
      this.prisma.admissionEnquiry.findMany({
        where: {
          tenantId,
          tourOn: day,
          stage: { notIn: ['enrolled', 'lost'] },
        },
        select: { childName: true, parentName: true, phone: true },
        take: 10,
      }),
      this.prisma.appointment.count({
        where: {
          tenantId,
          date: { gt: day, lte: toDbDate(addDays(today, 7)) },
          status: AppointmentStatus.scheduled,
        },
      }),
    ]);
    return {
      today: appointments,
      tours,
      laterThisWeek: later,
      waiting: appointments.filter(
        (a) => a.status === AppointmentStatus.scheduled && a.time < now,
      ).length,
    };
  }
}
