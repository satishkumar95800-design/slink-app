import { Injectable } from '@nestjs/common';
import { Gender, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeacherDashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
          this.prisma.report.findMany({
            where: { tenantId, teacherId: teacher.id },
            select: { _count: { select: { readReceipts: true } } },
          }),
        ]);

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          classCount,
          subjectCount: distinctSubjects.length,
          weeklyPeriods,
          reportsSent: reports.length,
          reportsUnread: reports.filter((r) => r._count.readReceipts === 0).length,
        };
      }),
    );
  }
}
