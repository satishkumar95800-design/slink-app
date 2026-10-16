import { BadRequestException, Injectable } from '@nestjs/common';
import { EmployeeStatus, StaffAttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  fromDbDate,
  isValidYmd,
  toDbDate,
} from '../attendance/attendance-dates';
import { DayRecord, computePeriod, dayKind } from './attendance.math';
import { SaveDailyDto } from './dto/hrms.dto';
import { HrSettingsService } from './hr-settings.service';
import { loadHolidays } from './hrms-calendar';
import { eachDate, isMonth, monthBounds } from './hrms-dates';
import { hrmsStrings as t } from './hrms.strings';
import { Db, audit, fail, todayFor } from './hrms.shared';

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: HrSettingsService,
  ) {}

  /** Daily sheet: every employee employed on [date] with what is recorded (or derived) for them. */
  async daily(tenantId: string, date: string) {
    if (!isValidYmd(date))
      fail(BadRequestException, 'INVALID_DATE', t.attendanceDate);
    const s = await this.settings.get(tenantId);
    const holidays = await loadHolidays(this.prisma, tenantId, date, date);
    const kind = dayKind(date, s.weeklyOffDays, new Set(holidays.keys()));
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        joinDate: { lte: toDbDate(date) },
        OR: [{ exitDate: null }, { exitDate: { gte: toDbDate(date) } }],
        status: EmployeeStatus.ACTIVE,
      },
      orderBy: { name: 'asc' },
    });
    const rows = await this.prisma.staffAttendance.findMany({
      where: {
        tenantId,
        date: toDbDate(date),
        employeeId: { in: employees.map((e) => e.id) },
      },
    });
    const byEmp = new Map(rows.map((r) => [r.employeeId, r]));
    return {
      date,
      dayKind: kind,
      holidayName: holidays.get(date) ?? null,
      rows: employees.map((e) => {
        const r = byEmp.get(e.id);
        return {
          employeeId: e.id,
          employeeCode: e.employeeCode,
          name: e.name,
          designation: e.designation,
          department: e.department,
          status: r?.status ?? null,
          note: r?.note ?? null,
          /** Written by an approved leave: change it by cancelling the leave. */
          leaveLinked: !!r?.leaveRequestId,
        };
      }),
    };
  }

  async saveDaily(tenantId: string, user: ActiveUser, dto: SaveDailyDto) {
    if (!isValidYmd(dto.date))
      fail(BadRequestException, 'INVALID_DATE', t.attendanceDate);
    if (dto.date > (await todayFor(this.prisma, tenantId)))
      fail(BadRequestException, 'FUTURE_DATE', t.attendanceFuture);
    const ids = dto.entries.map((e) => e.employeeId);
    if (new Set(ids).size !== ids.length)
      fail(BadRequestException, 'DUPLICATE_EMPLOYEE', t.attendanceDuplicate);
    const day = toDbDate(dto.date);
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        id: { in: ids },
        status: EmployeeStatus.ACTIVE,
        joinDate: { lte: day },
        OR: [{ exitDate: null }, { exitDate: { gte: day } }],
      },
      select: { id: true },
    });
    if (employees.length !== ids.length)
      fail(BadRequestException, 'EMPLOYEE_NOT_FOUND', t.attendanceEmployee);

    const skipped: string[] = [];
    const counts: Record<string, number> = {};
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.staffAttendance.findMany({
        where: { tenantId, date: day, employeeId: { in: ids } },
        select: { employeeId: true, leaveRequestId: true },
      });
      const linked = new Set(
        existing.filter((r) => r.leaveRequestId).map((r) => r.employeeId),
      );
      for (const e of dto.entries) {
        if (linked.has(e.employeeId)) {
          skipped.push(e.employeeId);
          continue;
        }
        await tx.staffAttendance.upsert({
          where: { employeeId_date: { employeeId: e.employeeId, date: day } },
          create: {
            tenantId,
            employeeId: e.employeeId,
            date: day,
            status: e.status,
            note: e.note ?? null,
            markedBy: user.id,
          },
          update: { status: e.status, note: e.note ?? null, markedBy: user.id },
        });
        counts[e.status] = (counts[e.status] ?? 0) + 1;
      }
      await audit(
        tx,
        tenantId,
        user.id,
        'hrms.attendance.save',
        'staff_attendance',
        null,
        {
          date: dto.date,
          counts,
          skippedLeaveLinked: skipped.length,
        },
      );
    });
    return {
      date: dto.date,
      saved: dto.entries.length - skipped.length,
      skipped,
    };
  }

  /** Stored rows per employee for payroll and the month summary. */
  async recordsFor(
    db: Db,
    tenantId: string,
    employeeIds: string[],
    from: string,
    to: string,
  ): Promise<Map<string, Map<string, DayRecord>>> {
    const rows = await db.staffAttendance.findMany({
      where: {
        tenantId,
        employeeId: { in: employeeIds },
        date: { gte: toDbDate(from), lte: toDbDate(to) },
      },
      include: {
        leaveRequest: { select: { leaveType: { select: { isPaid: true } } } },
      },
    });
    const out = new Map<string, Map<string, DayRecord>>();
    for (const r of rows) {
      const m = out.get(r.employeeId) ?? new Map<string, DayRecord>();
      m.set(fromDbDate(r.date), {
        status: r.status,
        leavePaid: r.leaveRequest ? r.leaveRequest.leaveType.isPaid : null,
      });
      out.set(r.employeeId, m);
    }
    return out;
  }

  /** Month summary per employee: counts of each status, weekly offs, holidays, unmarked days and LOP days. */
  async monthly(tenantId: string, month: string, employeeId?: string) {
    if (!isMonth(month))
      fail(BadRequestException, 'MONTH_INVALID', t.monthInvalid);
    const { from, to } = monthBounds(month);
    const s = await this.settings.get(tenantId);
    const holidays = await loadHolidays(this.prisma, tenantId, from, to);
    const holidaySet = new Set(holidays.keys());
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        ...(employeeId && { id: employeeId }),
        joinDate: { lte: toDbDate(to) },
        OR: [{ exitDate: null }, { exitDate: { gte: toDbDate(from) } }],
      },
      orderBy: { name: 'asc' },
    });
    const records = await this.recordsFor(
      this.prisma,
      tenantId,
      employees.map((e) => e.id),
      from,
      to,
    );
    const dates = eachDate(from, to);
    const weeklyOffs = dates.filter(
      (d) => dayKind(d, s.weeklyOffDays, holidaySet) === 'WEEKLY_OFF',
    ).length;
    return {
      month,
      holidays: [...holidays].map(([date, name]) => ({ date, name })),
      weeklyOffDays: s.weeklyOffDays,
      rows: employees.map((e) => {
        const recs = records.get(e.id) ?? new Map<string, DayRecord>();
        const count = (st: StaffAttendanceStatus) =>
          [...recs.values()].filter((r) => r.status === st).length;
        const period = computePeriod({
          month,
          rule: s.workingDaysRule,
          weeklyOff: s.weeklyOffDays,
          holidays: holidaySet,
          records: recs,
          treatUnmarkedAsAbsent: s.treatUnmarkedAsAbsent,
          joinDate: fromDbDate(e.joinDate),
          exitDate: e.exitDate ? fromDbDate(e.exitDate) : null,
        });
        return {
          employeeId: e.id,
          employeeCode: e.employeeCode,
          name: e.name,
          present: count('PRESENT'),
          absent: count('ABSENT'),
          halfDay: count('HALF_DAY'),
          onLeave: count('ON_LEAVE'),
          markedHoliday: count('HOLIDAY'),
          unmarked: period.unmarkedDays,
          lopDays: period.lopTenths / 10,
          days: employeeId
            ? dates.map((d) => ({
                date: d,
                status: recs.get(d)?.status ?? null,
                dayKind: dayKind(d, s.weeklyOffDays, holidaySet),
              }))
            : undefined,
        };
      }),
      totals: { weeklyOffs, holidays: holidays.size, days: dates.length },
    };
  }
}
