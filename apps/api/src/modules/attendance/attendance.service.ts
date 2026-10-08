import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, NotificationChannel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  academicYearRange,
  daysBetween,
  displayDate,
  fromDbDate,
  isValidYmd,
  monthRange,
  toDbDate,
  todayIn,
} from './attendance-dates';
import { attendanceStrings as t } from './attendance.strings';
import { AttendanceReportQueryDto } from './dto/attendance-query.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

const ADMIN_ROLES: Role[] = [Role.admin, Role.super_admin];
const MAX_RANGE_DAYS = 366;

type Counts = { present: number; absent: number; late: number; leave: number };

/** Late counts as attended; every marked day (incl. leave) is in the denominator. Holidays are never marked, so never counted. */
export function summarise(counts: Counts) {
  const daysMarked = counts.present + counts.absent + counts.late + counts.leave;
  const daysPresent = counts.present + counts.late;
  return {
    ...counts,
    daysMarked,
    daysPresent,
    percentage: daysMarked === 0 ? null : Math.round((daysPresent / daysMarked) * 1000) / 10,
  };
}

function emptyCounts(): Counts {
  return { present: 0, absent: 0, late: 0, leave: 0 };
}

/** Roll numbers sort numerically when they are numbers ("2" before "10"); students without one go last, then by name. */
function compareRoster(a: { rollNo: string | null; name: string }, b: { rollNo: string | null; name: string }) {
  if (a.rollNo && b.rollNo) {
    const byRoll = a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
    if (byRoll !== 0) return byRoll;
  } else if (a.rollNo || b.rollNo) {
    return a.rollNo ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Roster & marking ───────────────────────────────────────────────────────

  async getRoster(tenantId: string, classId: string, date: string | undefined, user: ActiveUser) {
    const cls = await this.requireClass(tenantId, classId);
    const canMark = this.canMark(cls, user);
    if (!canMark && !this.isAssigned(cls, user) && !ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException(t.notYourClass);
    }

    const timeZone = await this.timeZone(tenantId);
    const today = todayIn(timeZone);
    const day = date ?? today;
    this.assertValidDate(day);

    const [students, records, holiday] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId, classId },
        select: { id: true, name: true, admissionNo: true, rollNo: true, photoUrl: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, classId, date: toDbDate(day) },
        select: { studentId: true, status: true, note: true, markedAt: true, updatedAt: true },
      }),
      this.prisma.schoolHoliday.findUnique({ where: { tenantId_date: { tenantId, date: toDbDate(day) } } }),
    ]);
    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    return {
      class: { id: cls.id, name: cls.name, section: cls.section },
      date: day,
      today,
      holiday: holiday ? { name: holiday.name } : null,
      submitted: records.length > 0,
      lastUpdatedAt: records.reduce<Date | null>((max, r) => (!max || r.updatedAt > max ? r.updatedAt : max), null),
      canEdit: canMark && this.withinEditWindow(user, day, today) && !holiday,
      students: [...students].sort(compareRoster).map((s) => ({
        ...s,
        status: byStudent.get(s.id)?.status ?? null,
        note: byStudent.get(s.id)?.note ?? null,
      })),
    };
  }

  async submit(tenantId: string, dto: SubmitAttendanceDto, user: ActiveUser) {
    const cls = await this.requireClass(tenantId, dto.classId);
    if (!this.canMark(cls, user)) throw new ForbiddenException(t.notYourClass);

    this.assertValidDate(dto.date);
    const timeZone = await this.timeZone(tenantId);
    const today = todayIn(timeZone);
    if (dto.date > today) throw new BadRequestException(t.futureDate);
    if (!this.withinEditWindow(user, dto.date, today)) throw new ForbiddenException(t.teacherTodayOnly);

    const day = toDbDate(dto.date);
    const holiday = await this.prisma.schoolHoliday.findUnique({ where: { tenantId_date: { tenantId, date: day } } });
    if (holiday) throw new BadRequestException(t.holiday(holiday.name));

    const studentIds = dto.entries.map((e) => e.studentId);
    if (new Set(studentIds).size !== studentIds.length) throw new BadRequestException(t.duplicateStudent);
    const students = await this.prisma.student.findMany({
      where: { tenantId, classId: cls.id, id: { in: studentIds } },
      select: { id: true, name: true },
    });
    if (students.length !== studentIds.length) throw new BadRequestException(t.studentNotInClass);
    const nameById = new Map(students.map((s) => [s.id, s.name]));

    const existing = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, date: day, studentId: { in: studentIds } },
      select: { studentId: true, status: true, note: true, absenceAlertSent: true },
    });
    const before = new Map(existing.map((r) => [r.studentId, r]));

    const changes = dto.entries
      .map((e) => ({ entry: e, prev: before.get(e.studentId) }))
      .filter(({ entry, prev }) => !prev || prev.status !== entry.status || (prev.note ?? null) !== (entry.note?.trim() || null));

    await this.prisma.$transaction(async (tx) => {
      for (const { entry } of changes) {
        const note = entry.note?.trim() || null;
        await tx.attendanceRecord.upsert({
          where: { tenantId_studentId_date: { tenantId, studentId: entry.studentId, date: day } },
          create: { tenantId, classId: cls.id, studentId: entry.studentId, date: day, status: entry.status, note, markedBy: user.id },
          update: { classId: cls.id, status: entry.status, note, markedBy: user.id },
        });
      }
      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            tenantId,
            actorId: user.id,
            action: existing.length > 0 ? 'attendance.update' : 'attendance.create',
            entityType: 'attendance',
            entityId: cls.id,
            diff: {
              classId: cls.id,
              date: dto.date,
              changes: changes.map(({ entry, prev }) => ({
                studentId: entry.studentId,
                from: prev?.status ?? null,
                to: entry.status,
              })),
            } satisfies Prisma.InputJsonValue,
          },
        });
      }
    });

    // Parent pushes describe "today", so only same-day marking sends them; admin back-dated corrections don't.
    if (dto.date === today) {
      await this.sendAbsenceAlerts(tenantId, dto.date, dto.entries, before, nameById);
    }

    return this.getRoster(tenantId, cls.id, dto.date, user);
  }

  /**
   * One "absent" push per child per day; if the teacher later changes that
   * child away from absent, one correction push. absenceAlertSent tracks which
   * of the two parents currently believe, so re-submits don't re-notify.
   */
  private async sendAbsenceAlerts(
    tenantId: string,
    date: string,
    entries: SubmitAttendanceDto['entries'],
    before: Map<string, { status: AttendanceStatus; absenceAlertSent: boolean }>,
    nameById: Map<string, string>,
  ) {
    const alertSentBefore = (studentId: string) => before.get(studentId)?.absenceAlertSent ?? false;
    const toAlert = entries.filter((e) => e.status === AttendanceStatus.absent && !alertSentBefore(e.studentId));
    const toCorrect = entries.filter((e) => e.status !== AttendanceStatus.absent && alertSentBefore(e.studentId));
    if (toAlert.length === 0 && toCorrect.length === 0) return;

    const links = await this.prisma.studentParent.findMany({
      where: { studentId: { in: [...toAlert, ...toCorrect].map((e) => e.studentId) } },
      select: { studentId: true, parentId: true },
    });
    const parentsOf = (studentId: string) => links.filter((l) => l.studentId === studentId).map((l) => l.parentId);
    const shown = displayDate(date);

    const notify = async (studentId: string, title: string, body: string, status: AttendanceStatus) => {
      await Promise.all(
        parentsOf(studentId).map((parentId) =>
          this.notifications
            .send({
              tenantId,
              userId: parentId,
              channel: NotificationChannel.fcm,
              title,
              body,
              data: { type: 'attendance', studentId, date, status },
            })
            .catch((err) => this.logger.warn(`Attendance push to ${parentId} failed: ${(err as Error).message}`)),
        ),
      );
    };

    for (const e of toAlert) {
      const name = firstName(nameById.get(e.studentId) ?? '');
      await notify(e.studentId, t.absentTitle, t.absentBody(name, shown), e.status);
    }
    for (const e of toCorrect) {
      const name = firstName(nameById.get(e.studentId) ?? '');
      await notify(e.studentId, t.correctionTitle, t.correctionBody(name, t.statusLabel[e.status], shown), e.status);
    }

    const day = toDbDate(date);
    await this.prisma.$transaction([
      this.prisma.attendanceRecord.updateMany({
        where: { tenantId, date: day, studentId: { in: toAlert.map((e) => e.studentId) } },
        data: { absenceAlertSent: true },
      }),
      this.prisma.attendanceRecord.updateMany({
        where: { tenantId, date: day, studentId: { in: toCorrect.map((e) => e.studentId) } },
        data: { absenceAlertSent: false },
      }),
    ]);
  }

  /** Teacher dashboard: classes this user can mark, and whether today is already submitted. */
  async getMyClassesToday(tenantId: string, user: ActiveUser) {
    const timeZone = await this.timeZone(tenantId);
    const today = todayIn(timeZone);
    const day = toDbDate(today);

    const classes = await this.prisma.class.findMany({
      where: ADMIN_ROLES.includes(user.role) ? { tenantId } : { tenantId, teachers: { some: { teacherId: user.id } } },
      select: {
        id: true,
        name: true,
        section: true,
        teachers: { select: { teacherId: true, isClassTeacher: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ name: 'asc' }, { section: 'asc' }],
    });
    const markable = classes.filter((c) => this.canMark(c, user) && c._count.students > 0);

    const [marked, holiday] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['classId'],
        where: { tenantId, date: day, classId: { in: markable.map((c) => c.id) } },
        _count: { _all: true },
      }),
      this.prisma.schoolHoliday.findUnique({ where: { tenantId_date: { tenantId, date: day } } }),
    ]);
    const submitted = new Set(marked.map((m) => m.classId));

    return {
      date: today,
      holiday: holiday ? { name: holiday.name } : null,
      classes: markable.map((c) => ({
        id: c.id,
        name: c.name,
        section: c.section,
        studentCount: c._count.students,
        submitted: submitted.has(c.id),
      })),
    };
  }

  // ── Summaries ──────────────────────────────────────────────────────────────

  /** Parent calendar + summary card: one month of days, plus month and academic-year totals. */
  async getStudentSummary(tenantId: string, studentId: string, month: string | undefined, user: ActiveUser) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, tenantId },
      select: {
        id: true,
        name: true,
        classId: true,
        class: { select: { name: true, section: true, academicYear: true, teachers: { select: { teacherId: true } } } },
      },
    });
    if (!student) throw new NotFoundException(t.studentNotFound);
    await this.assertCanViewStudent(tenantId, student, user);

    const today = todayIn(await this.timeZone(tenantId));
    const selectedMonth = month ?? today.slice(0, 7);
    const range = monthRange(selectedMonth);
    if (!isValidYmd(range.from)) throw new BadRequestException(t.invalidDate);

    const [days, holidays, todayRecord] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, studentId, date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
        select: { date: true, status: true, note: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.schoolHoliday.findMany({
        where: { tenantId, date: { gte: toDbDate(range.from), lte: toDbDate(range.to) } },
        select: { date: true, name: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.attendanceRecord.findUnique({
        where: { tenantId_studentId_date: { tenantId, studentId, date: toDbDate(today) } },
        select: { status: true },
      }),
    ]);

    const monthCounts = emptyCounts();
    for (const d of days) monthCounts[d.status]++;

    const yearRange = academicYearRange(student.class.academicYear);
    const yearCounts = emptyCounts();
    if (yearRange) {
      const grouped = await this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { tenantId, studentId, date: { gte: toDbDate(yearRange.from), lte: toDbDate(yearRange.to) } },
        _count: { _all: true },
      });
      for (const g of grouped) yearCounts[g.status] = g._count._all;
    }

    return {
      student: { id: student.id, name: student.name, class: { name: student.class.name, section: student.class.section } },
      month: selectedMonth,
      today: { date: today, status: todayRecord?.status ?? null },
      days: days.map((d) => ({ date: fromDbDate(d.date), status: d.status, note: d.note })),
      holidays: holidays.map((h) => ({ date: fromDbDate(h.date), name: h.name })),
      monthSummary: summarise(monthCounts),
      academicYear: { label: student.class.academicYear, ...summarise(yearCounts) },
    };
  }

  /** Admin dashboard card: school-wide numbers for one day, and which classes are still unmarked. */
  async getSchoolSummary(tenantId: string, date: string | undefined) {
    const today = todayIn(await this.timeZone(tenantId));
    const day = date ?? today;
    this.assertValidDate(day);

    const [classes, grouped, holiday] = await Promise.all([
      this.prisma.class.findMany({
        where: { tenantId, students: { some: {} } },
        select: { id: true, name: true, section: true, _count: { select: { students: true } } },
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['classId', 'status'],
        where: { tenantId, date: toDbDate(day) },
        _count: { _all: true },
      }),
      this.prisma.schoolHoliday.findUnique({ where: { tenantId_date: { tenantId, date: toDbDate(day) } } }),
    ]);

    const countsByClass = new Map<string, Counts>();
    for (const g of grouped) {
      const counts = countsByClass.get(g.classId) ?? emptyCounts();
      counts[g.status] = g._count._all;
      countsByClass.set(g.classId, counts);
    }

    const perClass = classes.map((c) => {
      const counts = countsByClass.get(c.id);
      return {
        classId: c.id,
        name: c.name,
        section: c.section,
        studentCount: c._count.students,
        marked: Boolean(counts),
        ...summarise(counts ?? emptyCounts()),
      };
    });
    const markedClasses = perClass.filter((c) => c.marked);
    const totals = markedClasses.reduce(
      (acc, c) => ({ present: acc.present + c.present, absent: acc.absent + c.absent, late: acc.late + c.late, leave: acc.leave + c.leave }),
      emptyCounts(),
    );

    return {
      date: day,
      holiday: holiday ? { name: holiday.name } : null,
      totalStudents: classes.reduce((sum, c) => sum + c._count.students, 0),
      ...summarise(totals),
      classes: perClass,
      notMarked: perClass.filter((c) => !c.marked).map((c) => ({ classId: c.classId, name: c.name, section: c.section })),
    };
  }

  /** Admin Attendance page: per-student totals and percentage over a date range (CSV-exportable). */
  async getReport(tenantId: string, query: AttendanceReportQueryDto) {
    this.assertValidDate(query.from);
    this.assertValidDate(query.to);
    if (query.from > query.to) throw new BadRequestException(t.rangeReversed);
    if (daysBetween(query.from, query.to) > MAX_RANGE_DAYS) throw new BadRequestException(t.rangeTooLong);
    if (query.classId) await this.requireClass(tenantId, query.classId);

    const students = await this.prisma.student.findMany({
      where: { tenantId, ...(query.classId ? { classId: query.classId } : {}) },
      select: { id: true, name: true, admissionNo: true, rollNo: true, class: { select: { name: true, section: true } } },
    });
    const grouped = await this.prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: {
        tenantId,
        studentId: { in: students.map((s) => s.id) },
        date: { gte: toDbDate(query.from), lte: toDbDate(query.to) },
      },
      _count: { _all: true },
    });
    const countsByStudent = new Map<string, Counts>();
    for (const g of grouped) {
      const counts = countsByStudent.get(g.studentId) ?? emptyCounts();
      counts[g.status] = g._count._all;
      countsByStudent.set(g.studentId, counts);
    }

    const rows = [...students]
      .sort((a, b) => `${a.class.name} ${a.class.section ?? ''}`.localeCompare(`${b.class.name} ${b.class.section ?? ''}`) || compareRoster(a, b))
      .map((s) => {
        const summary = summarise(countsByStudent.get(s.id) ?? emptyCounts());
        return {
          studentId: s.id,
          rollNo: s.rollNo,
          studentName: s.name,
          admissionNo: s.admissionNo,
          className: [s.class.name, s.class.section].filter(Boolean).join(' '),
          daysMarked: summary.daysMarked,
          present: summary.present,
          late: summary.late,
          absent: summary.absent,
          leave: summary.leave,
          percentage: summary.percentage,
        };
      });
    return { from: query.from, to: query.to, data: rows };
  }

  // ── Holidays ───────────────────────────────────────────────────────────────

  async listHolidays(tenantId: string, from?: string, to?: string) {
    const rows = await this.prisma.schoolHoliday.findMany({
      where: {
        tenantId,
        ...(from || to
          ? { date: { ...(from ? { gte: toDbDate(from) } : {}), ...(to ? { lte: toDbDate(to) } : {}) } }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
    return rows.map((h) => ({ id: h.id, date: fromDbDate(h.date), name: h.name }));
  }

  async createHoliday(tenantId: string, dto: CreateHolidayDto, user: ActiveUser) {
    this.assertValidDate(dto.date);
    try {
      const h = await this.prisma.schoolHoliday.create({
        data: { tenantId, date: toDbDate(dto.date), name: dto.name.trim() },
      });
      await this.prisma.auditLog.create({
        data: { tenantId, actorId: user.id, action: 'holiday.create', entityType: 'school_holiday', entityId: h.id, diff: { date: dto.date, name: h.name } },
      });
      return { id: h.id, date: fromDbDate(h.date), name: h.name };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(t.holidayExists);
      }
      throw err;
    }
  }

  async deleteHoliday(tenantId: string, id: string, user: ActiveUser) {
    const h = await this.prisma.schoolHoliday.findFirst({ where: { id, tenantId } });
    if (!h) throw new NotFoundException(t.holidayNotFound);
    await this.prisma.schoolHoliday.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { tenantId, actorId: user.id, action: 'holiday.delete', entityType: 'school_holiday', entityId: id, diff: { date: fromDbDate(h.date), name: h.name } },
    });
  }

  // ── Access rules ───────────────────────────────────────────────────────────

  private async requireClass(tenantId: string, classId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: { id: true, name: true, section: true, teachers: { select: { teacherId: true, isClassTeacher: true } } },
    });
    if (!cls) throw new NotFoundException(t.classNotFound);
    return cls;
  }

  /**
   * Admins mark any class. A teacher marks a class they're the class teacher of;
   * if the class has no class teacher flagged, any teacher assigned to it may.
   */
  private canMark(cls: { teachers: { teacherId: string; isClassTeacher: boolean }[] }, user: ActiveUser) {
    if (ADMIN_ROLES.includes(user.role)) return true;
    if (user.role !== Role.teacher) return false;
    const classTeachers = cls.teachers.filter((ct) => ct.isClassTeacher);
    const eligible = classTeachers.length > 0 ? classTeachers : cls.teachers;
    return eligible.some((ct) => ct.teacherId === user.id);
  }

  private isAssigned(cls: { teachers: { teacherId: string }[] }, user: ActiveUser) {
    return user.role === Role.teacher && cls.teachers.some((ct) => ct.teacherId === user.id);
  }

  /** Teachers may only touch today's attendance (until midnight in the school's timezone); admins any past day. */
  private withinEditWindow(user: ActiveUser, date: string, today: string) {
    if (date > today) return false;
    return ADMIN_ROLES.includes(user.role) || date === today;
  }

  /** Parents: only their own children (via student_parents). Teachers: students in classes they're assigned to. Admins: anyone in the school. */
  private async assertCanViewStudent(
    tenantId: string,
    student: { id: string; class: { teachers: { teacherId: string }[] } },
    user: ActiveUser,
  ) {
    if (ADMIN_ROLES.includes(user.role)) return;
    if (user.role === Role.teacher && student.class.teachers.some((ct) => ct.teacherId === user.id)) return;
    if (user.role === Role.parent) {
      const link = await this.prisma.studentParent.findFirst({
        where: { studentId: student.id, parentId: user.id, student: { tenantId } },
        select: { studentId: true },
      });
      if (link) return;
    }
    throw new ForbiddenException(t.notYourStudent);
  }

  private assertValidDate(ymd: string) {
    if (!isValidYmd(ymd)) throw new BadRequestException(t.invalidDate);
  }

  private async timeZone(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    return tenant?.timezone || 'Asia/Kolkata';
  }
}
