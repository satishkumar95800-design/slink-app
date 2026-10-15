import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, ReportType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { effectiveLanguage, isLanguage } from '../../common/i18n/languages';
import type { Language } from '../../common/i18n/languages';
import { AiService } from './ai.service';

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  kn: 'Kannada',
  hi: 'Hindi',
};

const SYSTEM = `You help a school teacher in India write the "teacher's remark" on a student's report card.
Write 2–4 warm, specific, honest sentences addressed to the parents about the child, using only the facts given.
- Mention one or two real strengths and one clear, kind next step.
- Never invent marks, events or traits that are not in the facts. If facts are thin, keep it short and general.
- No labels or diagnoses; nothing about family, caste, religion or health.
- Use the child's first name. Digits 0-9 for numbers.
Reply with the remark text only, in the language asked for.`;

const NOTE_WINDOW_DAYS = 120;

/**
 * Report-card remark drafts (docs/SPEC-ai.md 1.2). Built from attendance,
 * recent academic grades, the kinds of notes on file (counts only, never their
 * text) and the teacher's own points. The teacher edits before publishing.
 */
@Injectable()
export class RemarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async draft(
    tenantId: string,
    user: ActiveUser,
    input: { studentId: string; points?: string; language?: string },
  ): Promise<{ remark: string; language: Language }> {
    const student = await this.prisma.student.findUnique({
      where: { id: input.studentId, tenantId },
      select: {
        name: true,
        classId: true,
        class: { select: { name: true, academicYear: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (user.role === Role.teacher) {
      const link = await this.prisma.classTeacher.findFirst({
        where: { classId: student.classId, teacherId: user.id },
        select: { classId: true },
      });
      if (!link) throw new ForbiddenException('Not your student');
    }

    const language = await this.languageFor(tenantId, user.id, input.language);
    const facts = await this.facts(tenantId, input.studentId, student);
    const points = input.points?.trim();

    const remark = await this.ai.complete({
      tenantId,
      feature: 'report_remark',
      tier: 'smart',
      system: SYSTEM,
      maxTokens: 400,
      content: [
        `Write the remark in ${LANGUAGE_NAMES[language]}.`,
        `Facts:\n${facts.join('\n')}`,
        points ? `Teacher's own points (use these first):\n${points}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
    return { remark: remark.trim(), language };
  }

  private async facts(
    tenantId: string,
    studentId: string,
    student: { name: string; class: { name: string; academicYear: string } },
  ): Promise<string[]> {
    const since = new Date(Date.now() - NOTE_WINDOW_DAYS * 86_400_000);
    const [attendance, reports, notes] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: { tenantId, studentId },
        _count: { _all: true },
      }),
      this.prisma.report.findMany({
        where: { tenantId, studentId, type: ReportType.academic },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { term: true, content: true },
      }),
      this.prisma.studentNote.groupBy({
        by: ['type'],
        where: { tenantId, studentId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    const firstName = student.name.trim().split(/\s+/)[0];
    const facts = [
      `Child: ${firstName}, ${student.class.name} (${student.class.academicYear})`,
    ];

    const count = (s: AttendanceStatus) =>
      attendance.find((a) => a.status === s)?._count._all ?? 0;
    const marked = attendance.reduce((n, a) => n + a._count._all, 0);
    if (marked > 0) {
      const attended =
        count(AttendanceStatus.present) + count(AttendanceStatus.late);
      facts.push(
        `Attendance: ${Math.round((attended / marked) * 100)}% of ${marked} school days (late ${count(AttendanceStatus.late)} times)`,
      );
    }

    for (const r of reports) {
      const content = (r.content ?? {}) as Record<string, unknown>;
      const grades = content.grades;
      if (grades && typeof grades === 'object' && !Array.isArray(grades)) {
        const list = Object.entries(grades as Record<string, unknown>)
          .map(([subject, grade]) => `${subject} ${String(grade)}`)
          .join(', ');
        if (list) facts.push(`Grades (${r.term}): ${list}`);
      }
    }

    const noteCounts = notes
      .filter((n) => n.type !== 'note')
      .map((n) => `${n._count._all} ${n.type.replace('_', ' ')}`);
    if (noteCounts.length) {
      facts.push(
        `School notes in the last ${NOTE_WINDOW_DAYS} days: ${noteCounts.join(', ')}`,
      );
    }
    return facts;
  }

  private async languageFor(tenantId: string, userId: string, asked?: string) {
    if (isLanguage(asked)) return asked;
    const [user, tenant] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferredLanguage: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { defaultLanguage: true },
      }),
    ]);
    return effectiveLanguage(user?.preferredLanguage, tenant?.defaultLanguage);
  }
}
