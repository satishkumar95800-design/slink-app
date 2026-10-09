import { Injectable } from '@nestjs/common';
import { Gender, ReportType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BroadcastsService } from '../broadcasts/broadcasts.service';
import { toDbDate, todayIn } from '../attendance/attendance-dates';

const WEEKDAY_NUMBER: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

@Injectable()
export class TeacherDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcasts: BroadcastsService,
  ) {}

  /**
   * Teacher "Today" strip (docs/SPEC-improvements.md §4.1): today's periods in
   * the school's timezone, with times from the school's period timings when set.
   * Sundays and school holidays return no periods.
   */
  async getToday(tenantId: string, teacherId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const timeZone = tenant?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const date = todayIn(timeZone, now);
    const weekday = WEEKDAY_NUMBER[new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now)];
    const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);

    const holiday = await this.prisma.schoolHoliday.findUnique({
      where: { tenantId_date: { tenantId, date: toDbDate(date) } },
      select: { name: true },
    });
    if (weekday === 7 || holiday) {
      return { date, weekday, nowTime, offDay: true, holiday: holiday?.name ?? null, timingsConfigured: false, periods: [] };
    }

    const [slots, timings] = await Promise.all([
      this.prisma.timetableSlot.findMany({
        where: { tenantId, teacherId, dayOfWeek: weekday },
        select: {
          periodNumber: true,
          class: { select: { id: true, name: true, section: true } },
          subject: { select: { name: true } },
        },
        orderBy: { periodNumber: 'asc' },
      }),
      this.prisma.periodTiming.findMany({ where: { tenantId }, select: { periodNumber: true, startTime: true, endTime: true } }),
    ]);
    const timingByPeriod = new Map(timings.map((t) => [t.periodNumber, t]));

    return {
      date,
      weekday,
      nowTime,
      offDay: false,
      holiday: null,
      timingsConfigured: timings.length > 0,
      periods: slots.map((s) => ({
        periodNumber: s.periodNumber,
        startTime: timingByPeriod.get(s.periodNumber)?.startTime ?? null,
        endTime: timingByPeriod.get(s.periodNumber)?.endTime ?? null,
        class: s.class,
        subject: s.subject.name,
      })),
    };
  }

  /**
   * Addendum 4 / A10 — "About My Class(es)": per class the teacher is linked
   * to (ClassTeacher already covers both homeroom and subject-teacher access,
   * per the comment on TeacherSubject), strength/subjects/recent reports.
   * Deliberately excludes anything fee-related — see A10's standing rule that
   * fee data must never appear on the Teacher Dashboard.
   *
   * FOLLOW-UP (not built): A10 also calls for "pending report-cycle reminders"
   * (e.g. "Term 1 reports due Friday"), citing it as already scoped in the main
   * spec §3.2. No report-cycle/deadline concept exists anywhere in this
   * codebase yet (confirmed against the `reports` module) — this needs a
   * scoping pass of its own, not a bolt-on here. Left out of this response.
   */
  async getMyClasses(tenantId: string, teacherId: string) {
    const classLinks = await this.prisma.classTeacher.findMany({
      where: { teacherId, class: { tenantId } },
      select: {
        class: { select: { id: true, name: true, section: true, academicYear: true } },
      },
    });

    return Promise.all(
      classLinks.map(async ({ class: cls }) => {
        const [genderCounts, subjects, recentReports] = await Promise.all([
          this.prisma.student.groupBy({
            by: ['gender'],
            where: { tenantId, classId: cls.id },
            _count: { _all: true },
          }),
          this.prisma.teacherSubject.findMany({
            where: { tenantId, teacherId, classId: cls.id },
            select: { subject: { select: { id: true, name: true } } },
          }),
          this.prisma.report.findMany({
            where: { tenantId, teacherId, classId: cls.id },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              type: true,
              term: true,
              createdAt: true,
              student: { select: { id: true, name: true } },
              _count: { select: { readReceipts: true } },
            },
          }),
        ]);

        const countFor = (gender: Gender | null) =>
          genderCounts.find((g) => g.gender === gender)?._count._all ?? 0;
        const male = countFor(Gender.male);
        const female = countFor(Gender.female);
        const other = countFor(Gender.other);
        const unspecified = countFor(null);

        return {
          class: cls,
          strength: { male, female, other, unspecified, total: male + female + other + unspecified },
          subjects: subjects.map((s) => s.subject),
          recentReports: recentReports.map((r) => ({
            id: r.id,
            type: r.type,
            term: r.term,
            createdAt: r.createdAt,
            studentName: r.student.name,
            readByAnyParent: r._count.readReceipts > 0,
          })),
        };
      }),
    );
  }

  /**
   * Addendum 4 / A14 — Admin Dashboard "Teacher Workload" table. Report counts
   * are all-time (there's no report-cycle/term-deadline concept in this
   * codebase to scope "this term" by), and "unread" means no parent has read
   * it yet — a computed view, no new entity.
   */
  async getWorkload(tenantId: string) {
    const teachers = await this.prisma.user.findMany({
      where: { tenantId, role: Role.teacher },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      teachers.map(async (teacher) => {
        const [classCount, distinctSubjects, weeklyPeriods, reports] = await Promise.all([
          this.prisma.classTeacher.count({ where: { teacherId: teacher.id } }),
          this.prisma.teacherSubject.findMany({
            where: { tenantId, teacherId: teacher.id },
            select: { subjectId: true },
            distinct: ['subjectId'],
          }),
          this.prisma.timetableSlot.count({ where: { tenantId, teacherId: teacher.id } }),
          // Homework is counted once per message via its broadcast below, not once per student report.
          this.prisma.report.findMany({
            where: { tenantId, teacherId: teacher.id, type: { not: ReportType.homework } },
            select: { _count: { select: { readReceipts: true } } },
          }),
        ]);
        const sent = await this.prisma.broadcast.findMany({
          where: { tenantId, senderId: teacher.id },
          select: { id: true },
        });
        const seen = await this.broadcasts.seenCounts(tenantId, sent.map((b) => b.id));
        const unseenItems = sent.filter((b) => (seen.get(b.id)?.seen ?? 0) === 0).length;

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          classCount,
          subjectCount: distinctSubjects.length,
          weeklyPeriods,
          // Progress reports + notices + homework; unread = no parent has opened it yet.
          reportsSent: reports.length + sent.length,
          reportsUnread: reports.filter((r) => r._count.readReceipts === 0).length + unseenItems,
        };
      }),
    );
  }
}
