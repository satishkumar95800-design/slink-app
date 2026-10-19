import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTimetableSlotDto } from './dto/upsert-timetable-slot.dto';
import { PeriodTimingDto } from './dto/period-timings.dto';
import { loadPeriodSchedule } from './period-schedule';

const slotInclude = {
  teacher: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  class: {
    select: { id: true, name: true, section: true, academicYear: true },
  },
} as const;

@Injectable()
export class TimetableService {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin-side grid editor — every slot for one class, across all days/periods. */
  async findForClass(tenantId: string, classId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { tenantId, classId },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  /**
   * A teacher's own weekly routine, across every class they're assigned a
   * period in, with each period's bell times (null when none are set).
   */
  async findMine(tenantId: string, teacherId: string) {
    const slots = await this.prisma.timetableSlot.findMany({
      where: { tenantId, teacherId },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });
    const schedule = await loadPeriodSchedule(this.prisma, tenantId, [
      ...new Set(slots.map((s) => s.classId)),
    ]);
    return slots.map((s) => {
      const time = schedule.timeFor(s.classId, s.periodNumber);
      return {
        ...s,
        startTime: time?.startTime ?? null,
        endTime: time?.endTime ?? null,
      };
    });
  }

  /**
   * Create-or-replace one grid cell (class + day + period). Admin clicking an
   * already-filled cell edits it in place rather than erroring on the
   * uniqueness constraint.
   */
  async upsert(tenantId: string, dto: UpsertTimetableSlotDto) {
    const [cls, teacher, subject] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: dto.classId, tenantId } }),
      this.prisma.user.findUnique({ where: { id: dto.teacherId, tenantId } }),
      this.prisma.subject.findUnique({
        where: { id: dto.subjectId, tenantId },
      }),
    ]);
    if (!cls) throw new NotFoundException('Class not found');
    if (!teacher || teacher.role !== Role.teacher) {
      throw new BadRequestException('teacherId must be an existing teacher');
    }
    if (!subject) throw new NotFoundException('Subject not found');

    // A teacher only teaches the subjects they are assigned for this class (TeacherSubject).
    const assigned = await this.prisma.teacherSubject.findFirst({
      where: {
        tenantId,
        teacherId: dto.teacherId,
        subjectId: dto.subjectId,
        classId: dto.classId,
      },
      select: { id: true },
    });
    if (!assigned) {
      throw new BadRequestException({
        code: 'TEACHER_NOT_ASSIGNED',
        message: `${teacher.name} is not assigned to teach ${subject.name} in this class`,
      });
    }

    // Addendum 4 / A10 — a teacher can't be in two classes for the same period.
    const teacherConflict = await this.prisma.timetableSlot.findFirst({
      where: {
        tenantId,
        teacherId: dto.teacherId,
        dayOfWeek: dto.dayOfWeek,
        periodNumber: dto.periodNumber,
        NOT: { classId: dto.classId },
      },
      include: { class: { select: { name: true, section: true } } },
    });
    if (teacherConflict) {
      throw new BadRequestException(
        `${teacher.name} is already scheduled for ${teacherConflict.class.name} ${teacherConflict.class.section} at this day/period`,
      );
    }

    return this.prisma.timetableSlot.upsert({
      where: {
        tenantId_classId_dayOfWeek_periodNumber: {
          tenantId,
          classId: dto.classId,
          dayOfWeek: dto.dayOfWeek,
          periodNumber: dto.periodNumber,
        },
      },
      create: {
        tenantId,
        classId: dto.classId,
        teacherId: dto.teacherId,
        subjectId: dto.subjectId,
        dayOfWeek: dto.dayOfWeek,
        periodNumber: dto.periodNumber,
      },
      update: {
        teacherId: dto.teacherId,
        subjectId: dto.subjectId,
      },
      include: slotInclude,
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const result = await this.prisma.timetableSlot.deleteMany({
      where: { id, tenantId },
    });
    if (result.count === 0)
      throw new NotFoundException('Timetable slot not found');
  }

  // ── Period timings (bell schedule) ─────────────────────────────────────────

  listPeriodTimings(tenantId: string) {
    return this.prisma.periodTiming.findMany({
      where: { tenantId },
      select: { periodNumber: true, startTime: true, endTime: true },
      orderBy: { periodNumber: 'asc' },
    });
  }

  /** Replaces the school's whole bell schedule. */
  async replacePeriodTimings(tenantId: string, periods: PeriodTimingDto[]) {
    const sorted = checkedSchedule(periods);

    await this.prisma.$transaction([
      this.prisma.periodTiming.deleteMany({ where: { tenantId } }),
      this.prisma.periodTiming.createMany({
        data: sorted.map((p) => ({ tenantId, ...p })),
      }),
    ]);
    return this.listPeriodTimings(tenantId);
  }

  listClassPeriodTimings(tenantId: string) {
    return this.prisma.classPeriodTiming.findMany({
      where: { tenantId },
      select: {
        classId: true,
        periodNumber: true,
        startTime: true,
        endTime: true,
      },
      orderBy: [{ classId: 'asc' }, { periodNumber: 'asc' }],
    });
  }

  /** Gives each of these classes the same bell schedule; no periods = back to the school's. */
  async replaceClassPeriodTimings(
    tenantId: string,
    classIds: string[],
    periods: PeriodTimingDto[],
  ) {
    const sorted = checkedSchedule(periods);
    const ids = [...new Set(classIds)];
    const found = await this.prisma.class.count({
      where: { tenantId, id: { in: ids } },
    });
    if (found !== ids.length) throw new NotFoundException('Class not found');

    await this.prisma.$transaction([
      this.prisma.classPeriodTiming.deleteMany({
        where: { tenantId, classId: { in: ids } },
      }),
      this.prisma.classPeriodTiming.createMany({
        data: ids.flatMap((classId) =>
          sorted.map((p) => ({ tenantId, classId, ...p })),
        ),
      }),
    ]);
    return this.listClassPeriodTimings(tenantId);
  }
}

/** Sorted by period; rejects overlaps and repeats. "HH:MM" strings compare correctly as text. */
function checkedSchedule(periods: PeriodTimingDto[]): PeriodTimingDto[] {
  const sorted = [...periods].sort((a, b) => a.periodNumber - b.periodNumber);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (p.startTime >= p.endTime) {
      throw new BadRequestException(
        `Period ${p.periodNumber} must end after it starts`,
      );
    }
    if (i > 0 && sorted[i - 1].periodNumber === p.periodNumber) {
      throw new BadRequestException(`Period ${p.periodNumber} is listed twice`);
    }
    if (i > 0 && sorted[i - 1].endTime > p.startTime) {
      throw new BadRequestException(
        `Period ${p.periodNumber} starts before period ${sorted[i - 1].periodNumber} ends`,
      );
    }
  }
  return sorted;
}
