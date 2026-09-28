import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTimetableSlotDto } from './dto/upsert-timetable-slot.dto';

const slotInclude = {
  teacher: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true, section: true, academicYear: true } },
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

  /** A teacher's own weekly routine, across every class they're assigned a period in. */
  async findMine(tenantId: string, teacherId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { tenantId, teacherId },
      include: slotInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
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
      this.prisma.subject.findUnique({ where: { id: dto.subjectId, tenantId } }),
    ]);
    if (!cls) throw new NotFoundException('Class not found');
    if (!teacher || teacher.role !== Role.teacher) {
      throw new BadRequestException('teacherId must be an existing teacher');
    }
    if (!subject) throw new NotFoundException('Subject not found');

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
    const result = await this.prisma.timetableSlot.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new NotFoundException('Timetable slot not found');
  }
}
