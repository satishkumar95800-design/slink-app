import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  LeaveRequestStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { effectiveLanguage } from '../../common/i18n/languages';
import { NotificationsService } from '../notifications/notifications.service';
import {
  displayDate,
  fromDbDate,
  isValidYmd,
  toDbDate,
} from '../attendance/attendance-dates';
import {
  ApplyLeaveDto,
  CreateLeaveTypeDto,
  LeaveRequestQueryDto,
  UpdateLeaveTypeDto,
} from './dto/hrms.dto';
import { HrSettings, HrSettingsService } from './hr-settings.service';
import { loadHolidays } from './hrms-calendar';
import { monthBounds } from './hrms-dates';
import {
  DEFAULT_LEAVE_TYPES,
  hrmsStrings as t,
  leaveDecisionPush,
} from './hrms.strings';
import { Db, audit, fail, isApprover, todayFor, withLock } from './hrms.shared';
import {
  Balance,
  daysToTenths,
  leaveBalance,
  leaveSpan,
  leaveYearOf,
  previousLeaveYear,
} from './leave.math';

const requestInclude = {
  leaveType: { select: { id: true, name: true, isPaid: true } },
  employee: {
    select: {
      id: true,
      name: true,
      employeeCode: true,
      userId: true,
      status: true,
    },
  },
} satisfies Prisma.LeaveRequestInclude;

type RequestRow = Prisma.LeaveRequestGetPayload<{
  include: typeof requestInclude;
}>;

type Year = { start: string; end: string };

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: HrSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── leave types ───────────────────────────────────────────────────────────

  async listTypes(tenantId: string, includeInactive = false) {
    // A school starts with a usual set it can edit or deactivate; types are never deleted, so this runs once.
    if ((await this.prisma.leaveType.count({ where: { tenantId } })) === 0) {
      await this.prisma.leaveType.createMany({
        data: DEFAULT_LEAVE_TYPES.map((d) => ({ tenantId, ...d })),
        skipDuplicates: true,
      });
    }
    const rows = await this.prisma.leaveType.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isPaid: 'desc' }, { name: 'asc' }],
    });
    return rows.map((r) => this.typeView(r));
  }

  private typeView(r: Prisma.LeaveTypeGetPayload<object>) {
    return {
      id: r.id,
      name: r.name,
      yearlyAllowance: Number(r.yearlyAllowance.toString()),
      carryForwardCap: Number(r.carryForwardCap.toString()),
      isPaid: r.isPaid,
      isActive: r.isActive,
    };
  }

  async createType(
    tenantId: string,
    user: ActiveUser,
    dto: CreateLeaveTypeDto,
  ) {
    await this.assertTypeNameFree(tenantId, dto.name, null);
    const row = await this.prisma.leaveType.create({
      data: {
        tenantId,
        name: dto.name,
        yearlyAllowance: dto.yearlyAllowance,
        carryForwardCap: dto.carryForwardCap ?? 0,
        isPaid: dto.isPaid,
      },
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.leave_type.create',
      'leave_type',
      row.id,
      {
        name: dto.name,
        yearlyAllowance: dto.yearlyAllowance,
        isPaid: dto.isPaid,
      },
    );
    return this.typeView(row);
  }

  async updateType(
    tenantId: string,
    user: ActiveUser,
    id: string,
    dto: UpdateLeaveTypeDto,
  ) {
    const current = await this.prisma.leaveType.findFirst({
      where: { id, tenantId },
    });
    if (!current) throw new NotFoundException(t.leaveTypeNotFound);
    if (dto.name !== undefined)
      await this.assertTypeNameFree(tenantId, dto.name, id);
    const row = await this.prisma.leaveType.update({
      where: { id },
      data: { ...dto },
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.leave_type.update',
      'leave_type',
      id,
      {
        before: this.typeView(current),
        after: this.typeView(row),
      },
    );
    return this.typeView(row);
  }

  private async assertTypeNameFree(
    tenantId: string,
    name: string,
    exceptId: string | null,
  ) {
    const clash = await this.prisma.leaveType.findFirst({
      where: {
        tenantId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) fail(ConflictException, 'LEAVE_TYPE_EXISTS', t.leaveTypeExists);
  }

  // ── balances (derived) ────────────────────────────────────────────────────

  /**
   * Balance per active leave type for the leave year containing [date]. Derived
   * from allowances and approved/pending requests, never stored.
   */
  async balances(tenantId: string, employeeId: string, date?: string) {
    const s = await this.settings.get(tenantId);
    const today = date ?? (await todayFor(this.prisma, tenantId));
    if (!isValidYmd(today))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const year = leaveYearOf(today, s.leaveYearStartMonth);
    const types = await this.prisma.leaveType.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isPaid: 'desc' }, { name: 'asc' }],
    });
    const out = [];
    for (const lt of types) {
      const b = await this.balanceFor(
        this.prisma,
        tenantId,
        employeeId,
        lt,
        year,
        s,
      );
      out.push(this.balanceView(lt, year, b));
    }
    return out;
  }

  private async balanceFor(
    db: Db,
    tenantId: string,
    employeeId: string,
    lt: {
      id: string;
      yearlyAllowance: Prisma.Decimal;
      carryForwardCap: Prisma.Decimal;
    },
    year: Year,
    s: HrSettings,
    excludeRequestId?: string,
  ): Promise<Balance> {
    const prev = previousLeaveYear(year, s.leaveYearStartMonth);
    const reqs = await db.leaveRequest.findMany({
      where: {
        tenantId,
        employeeId,
        leaveTypeId: lt.id,
        status: {
          in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING],
        },
        toDate: { gte: toDbDate(prev.start) },
        fromDate: { lte: toDbDate(year.end) },
        ...(excludeRequestId && { id: { not: excludeRequestId } }),
      },
    });
    const holidays = await loadHolidays(db, tenantId, prev.start, year.end);
    return this.balanceFromRequests(
      reqs,
      lt,
      year,
      s,
      new Set(holidays.keys()),
    );
  }

  private balanceFromRequests(
    reqs: Prisma.LeaveRequestGetPayload<object>[],
    lt: { yearlyAllowance: Prisma.Decimal; carryForwardCap: Prisma.Decimal },
    year: Year,
    s: HrSettings,
    holidaySet: ReadonlySet<string>,
  ): Balance {
    const prev = previousLeaveYear(year, s.leaveYearStartMonth);
    const tenthsIn = (r: (typeof reqs)[number], y: Year) => {
      const from = fromDbDate(r.fromDate);
      const to = fromDbDate(r.toDate);
      if (from >= y.start && to <= y.end) return daysToTenths(r.days);
      if (to < y.start || from > y.end) return 0;
      const span = leaveSpan(from, to, r.halfDay, s.weeklyOffDays, holidaySet);
      return span.dates.filter((d) => d >= y.start && d <= y.end).length * 10;
    };
    let used = 0;
    let pending = 0;
    let prevUsed = 0;
    for (const r of reqs) {
      if (r.status === LeaveRequestStatus.APPROVED) {
        used += tenthsIn(r, year);
        prevUsed += tenthsIn(r, prev);
      } else {
        pending += tenthsIn(r, year);
      }
    }
    return leaveBalance({
      allowanceTenths: daysToTenths(lt.yearlyAllowance),
      carryCapTenths: daysToTenths(lt.carryForwardCap),
      prevUsedTenths: prevUsed,
      usedTenths: used,
      pendingTenths: pending,
    });
  }

  /** Balances of every active employee, or of one employee, in one shape (one query for all requests). */
  async balancesForAll(tenantId: string, date?: string, employeeId?: string) {
    const s = await this.settings.get(tenantId);
    const today = date ?? (await todayFor(this.prisma, tenantId));
    if (!isValidYmd(today))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const year = leaveYearOf(today, s.leaveYearStartMonth);
    const prev = previousLeaveYear(year, s.leaveYearStartMonth);
    const [emps, types, reqs, holidays] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          tenantId,
          ...(employeeId
            ? { id: employeeId }
            : { status: EmployeeStatus.ACTIVE }),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, employeeCode: true },
      }),
      this.prisma.leaveType.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ isPaid: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          status: {
            in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING],
          },
          toDate: { gte: toDbDate(prev.start) },
          fromDate: { lte: toDbDate(year.end) },
        },
      }),
      loadHolidays(this.prisma, tenantId, prev.start, year.end),
    ]);
    const holidaySet = new Set(holidays.keys());
    return emps.map((e) => ({
      employeeId: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      balances: types.map((lt) => {
        const b = this.balanceFromRequests(
          reqs.filter((r) => r.employeeId === e.id && r.leaveTypeId === lt.id),
          lt,
          year,
          s,
          holidaySet,
        );
        return this.balanceView(lt, year, b);
      }),
    }));
  }

  private balanceView(
    lt: { id: string; name: string; isPaid: boolean },
    year: Year,
    b: Balance,
  ) {
    return {
      leaveTypeId: lt.id,
      name: lt.name,
      isPaid: lt.isPaid,
      yearStart: year.start,
      yearEnd: year.end,
      allowance: b.allowanceTenths / 10,
      carriedIn: b.carryInTenths / 10,
      used: b.usedTenths / 10,
      pending: b.pendingTenths / 10,
      available: b.availableTenths / 10,
    };
  }

  // ── requests ──────────────────────────────────────────────────────────────

  view(r: RequestRow) {
    return {
      id: r.id,
      employee: {
        id: r.employee.id,
        name: r.employee.name,
        employeeCode: r.employee.employeeCode,
      },
      leaveType: {
        id: r.leaveType.id,
        name: r.leaveType.name,
        isPaid: r.leaveType.isPaid,
      },
      fromDate: fromDbDate(r.fromDate),
      toDate: fromDbDate(r.toDate),
      halfDay: r.halfDay,
      days: Number(r.days.toString()),
      reason: r.reason,
      status: r.status,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionNote: r.decisionNote,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async listRequests(tenantId: string, q: LeaveRequestQueryDto) {
    const range = q.month ? monthBounds(q.month) : null;
    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
      ...(q.status && { status: q.status }),
      ...(q.employeeId && { employeeId: q.employeeId }),
      ...(range && {
        fromDate: { lte: toDbDate(range.to) },
        toDate: { gte: toDbDate(range.from) },
      }),
    };
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [total, rows] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.findMany({
        where,
        include: requestInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map((r) => this.view(r)), total, page, limit };
  }

  async listForEmployee(tenantId: string, employeeId: string) {
    const rows = await this.prisma.leaveRequest.findMany({
      where: { tenantId, employeeId },
      include: requestInclude,
      orderBy: [{ fromDate: 'desc' }],
      take: 100,
    });
    return rows.map((r) => this.view(r));
  }

  /**
   * Creates a PENDING request for [employeeId]. The caller decides who the
   * employee is (own record on mobile, any employee from the console); this
   * method never reads it from a request body.
   */
  async apply(
    tenantId: string,
    requestedBy: string,
    employeeId: string,
    dto: ApplyLeaveDto,
  ) {
    if (!isValidYmd(dto.fromDate) || !isValidYmd(dto.toDate))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    if (dto.toDate < dto.fromDate)
      fail(BadRequestException, 'RANGE_REVERSED', t.leaveRangeReversed);
    if (dto.halfDay && dto.fromDate !== dto.toDate)
      fail(BadRequestException, 'HALF_DAY_RANGE', t.leaveHalfDayRange);

    const created = await withLock(
      this.prisma,
      tenantId,
      'leave-decide',
      async (tx) => {
        const emp = await tx.employee.findFirst({
          where: { id: employeeId, tenantId },
        });
        if (!emp) throw new NotFoundException(t.employeeNotFound);
        if (emp.status !== EmployeeStatus.ACTIVE)
          fail(ConflictException, 'EMPLOYEE_INACTIVE', t.leaveEmployeeInactive);
        const lt = await tx.leaveType.findFirst({
          where: { id: dto.leaveTypeId, tenantId, isActive: true },
        });
        if (!lt)
          fail(
            BadRequestException,
            'LEAVE_TYPE_NOT_FOUND',
            t.leaveTypeNotFound,
          );
        const s = await this.settings.get(tenantId);
        const holidays = await loadHolidays(
          tx,
          tenantId,
          dto.fromDate,
          dto.toDate,
        );
        const span = leaveSpan(
          dto.fromDate,
          dto.toDate,
          !!dto.halfDay,
          s.weeklyOffDays,
          new Set(holidays.keys()),
        );
        if (span.tenths === 0)
          fail(BadRequestException, 'NO_WORKING_DAYS', t.leaveNoWorkingDays);

        const overlap = await tx.leaveRequest.findFirst({
          where: {
            tenantId,
            employeeId,
            status: {
              in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
            },
            fromDate: { lte: toDbDate(dto.toDate) },
            toDate: { gte: toDbDate(dto.fromDate) },
          },
          select: { id: true },
        });
        if (overlap) fail(ConflictException, 'LEAVE_OVERLAP', t.leaveOverlap);

        await this.assertBalance(
          tx,
          tenantId,
          employeeId,
          lt!,
          span.dates,
          !!dto.halfDay,
          s,
        );

        const row = await tx.leaveRequest.create({
          data: {
            tenantId,
            employeeId,
            leaveTypeId: lt!.id,
            fromDate: toDbDate(dto.fromDate),
            toDate: toDbDate(dto.toDate),
            halfDay: !!dto.halfDay,
            days: span.tenths / 10,
            reason: dto.reason,
            requestedBy,
          },
          include: requestInclude,
        });
        await audit(
          tx,
          tenantId,
          requestedBy,
          'hrms.leave.apply',
          'leave_request',
          row.id,
          {
            employeeId,
            leaveTypeId: lt!.id,
            from: dto.fromDate,
            to: dto.toDate,
            days: span.tenths / 10,
          },
        );
        return row;
      },
    );
    return this.view(created);
  }

  /** Paid leave types are capped by balance (per leave year touched); unpaid types are unlimited. */
  private async assertBalance(
    db: Db,
    tenantId: string,
    employeeId: string,
    lt: {
      id: string;
      isPaid: boolean;
      yearlyAllowance: Prisma.Decimal;
      carryForwardCap: Prisma.Decimal;
    },
    dates: string[],
    halfDay: boolean,
    s: HrSettings,
    excludeRequestId?: string,
  ) {
    if (!lt.isPaid) return;
    const perYear = new Map<string, { year: Year; tenths: number }>();
    for (const d of dates) {
      const y = leaveYearOf(d, s.leaveYearStartMonth);
      const e = perYear.get(y.start) ?? { year: y, tenths: 0 };
      e.tenths += halfDay ? 5 : 10;
      perYear.set(y.start, e);
    }
    for (const { year, tenths } of perYear.values()) {
      const b = await this.balanceFor(
        db,
        tenantId,
        employeeId,
        lt,
        year,
        s,
        excludeRequestId,
      );
      if (tenths > b.availableTenths)
        fail(ConflictException, 'INSUFFICIENT_BALANCE', t.leaveInsufficient);
    }
  }

  /** Cancel by the owner (mobile) or a manager. [ownEmployeeId] set means the caller may only touch their own request. */
  async cancel(
    tenantId: string,
    user: ActiveUser,
    id: string,
    ownEmployeeId: string | null,
  ) {
    const today = await todayFor(this.prisma, tenantId);
    const row = await withLock(
      this.prisma,
      tenantId,
      'leave-decide',
      async (tx) => {
        const r = await tx.leaveRequest.findFirst({
          where: {
            id,
            tenantId,
            ...(ownEmployeeId && { employeeId: ownEmployeeId }),
          },
          include: requestInclude,
        });
        if (!r) throw new NotFoundException(t.leaveRequestNotFound);
        if (
          r.status !== LeaveRequestStatus.PENDING &&
          r.status !== LeaveRequestStatus.APPROVED
        )
          fail(ConflictException, 'NOT_CANCELLABLE', t.leaveNotCancellable);
        if (
          ownEmployeeId &&
          r.status === LeaveRequestStatus.APPROVED &&
          fromDbDate(r.fromDate) <= today
        )
          fail(ForbiddenException, 'LEAVE_STARTED', t.leaveStarted);
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: { status: LeaveRequestStatus.CANCELLED },
          include: requestInclude,
        });
        let released = 0;
        if (r.status === LeaveRequestStatus.APPROVED) {
          released = (
            await tx.staffAttendance.deleteMany({
              where: { tenantId, leaveRequestId: id },
            })
          ).count;
        }
        await audit(
          tx,
          tenantId,
          user.id,
          'hrms.leave.cancel',
          'leave_request',
          id,
          {
            previousStatus: r.status,
            releasedAttendanceDays: released,
            byOwner: !!ownEmployeeId,
          },
        );
        return updated;
      },
    );
    return this.view(row);
  }

  async approve(tenantId: string, user: ActiveUser, id: string, note?: string) {
    return this.decide(tenantId, user, id, true, note);
  }

  async reject(tenantId: string, user: ActiveUser, id: string, note?: string) {
    if (!note?.trim())
      fail(BadRequestException, 'NOTE_REQUIRED', t.leaveNoteRequired);
    return this.decide(tenantId, user, id, false, note);
  }

  private async decide(
    tenantId: string,
    user: ActiveUser,
    id: string,
    approve: boolean,
    note?: string,
  ) {
    const result = await withLock(
      this.prisma,
      tenantId,
      'leave-decide',
      async (tx) => {
        const r = await tx.leaveRequest.findFirst({
          where: { id, tenantId },
          include: requestInclude,
        });
        if (!r) throw new NotFoundException(t.leaveRequestNotFound);
        if (r.status !== LeaveRequestStatus.PENDING)
          fail(ConflictException, 'NOT_PENDING', t.leaveNotPending);
        // Deciding your own leave: only an admin may, and it is flagged in the audit log.
        const own = r.employee.userId === user.id;
        if (own && !isApprover(user.role))
          fail(ForbiddenException, 'SELF_DECISION', t.leaveSelfDecision);

        const from = fromDbDate(r.fromDate);
        const to = fromDbDate(r.toDate);
        if (approve) {
          const s = await this.settings.get(tenantId);
          const holidays = await loadHolidays(tx, tenantId, from, to);
          const span = leaveSpan(
            from,
            to,
            r.halfDay,
            s.weeklyOffDays,
            new Set(holidays.keys()),
          );
          const lt = await tx.leaveType.findFirstOrThrow({
            where: { id: r.leaveTypeId },
          });
          await this.assertBalance(
            tx,
            tenantId,
            r.employeeId,
            lt,
            span.dates,
            r.halfDay,
            s,
            id,
          );
          for (const d of span.dates) {
            const day = toDbDate(d);
            await tx.staffAttendance.upsert({
              where: {
                employeeId_date: { employeeId: r.employeeId, date: day },
              },
              create: {
                tenantId,
                employeeId: r.employeeId,
                date: day,
                status: r.halfDay ? 'HALF_DAY' : 'ON_LEAVE',
                leaveRequestId: id,
                markedBy: user.id,
              },
              update: {
                status: r.halfDay ? 'HALF_DAY' : 'ON_LEAVE',
                leaveRequestId: id,
                markedBy: user.id,
              },
            });
          }
        }
        const updated = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: approve
              ? LeaveRequestStatus.APPROVED
              : LeaveRequestStatus.REJECTED,
            decidedBy: user.id,
            decidedAt: new Date(),
            decisionNote: note?.trim() || null,
          },
          include: requestInclude,
        });
        await audit(
          tx,
          tenantId,
          user.id,
          approve ? 'hrms.leave.approve' : 'hrms.leave.reject',
          'leave_request',
          id,
          {
            employeeId: r.employeeId,
            selfApproved: own,
            note: note?.trim() || null,
          },
        );
        return updated;
      },
    );
    await this.notifyDecision(tenantId, result, approve);
    return this.view(result);
  }

  /** Push to the applicant in their own language. Never blocks or fails the decision. */
  private async notifyDecision(
    tenantId: string,
    r: RequestRow,
    approved: boolean,
  ) {
    if (!r.employee.userId) return;
    try {
      const [target, tenant] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: r.employee.userId },
          select: { preferredLanguage: true },
        }),
        this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { defaultLanguage: true },
        }),
      ]);
      const lang = effectiveLanguage(
        target?.preferredLanguage,
        tenant?.defaultLanguage,
      );
      const text = leaveDecisionPush[lang];
      const from = displayDate(fromDbDate(r.fromDate));
      const to = displayDate(fromDbDate(r.toDate));
      const range = from === to ? from : `${from} - ${to}`;
      await this.notifications.send({
        tenantId,
        userId: r.employee.userId,
        channel: NotificationChannel.fcm,
        title: approved ? text.approvedTitle : text.rejectedTitle,
        body: approved
          ? text.approvedBody(range)
          : text.rejectedBody(range, r.decisionNote),
        data: {
          type: 'leave_request',
          leaveRequestId: r.id,
          status: approved ? 'approved' : 'rejected',
        },
      });
    } catch (err) {
      this.logger.warn(`Leave decision push failed: ${(err as Error).message}`);
    }
  }
}
