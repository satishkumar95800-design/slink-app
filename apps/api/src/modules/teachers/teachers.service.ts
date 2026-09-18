import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeacherSubjectDto } from './dto/create-teacher-subject.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId, role: Role.teacher },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        taughtClasses: {
          select: {
            isClassTeacher: true,
            class: { select: { id: true, name: true, section: true, academicYear: true } },
          },
        },
        taughtSubjects: {
          select: {
            id: true,
            subject: { select: { id: true, name: true } },
            class: { select: { id: true, name: true, section: true, academicYear: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Assigns a teacher to teach a subject in a class, granting class access via ClassTeacher. */
  async addSubject(tenantId: string, teacherId: string, dto: CreateTeacherSubjectDto) {
    await this.requireTeacher(tenantId, teacherId);

    const [subject, cls] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: dto.subjectId, tenantId } }),
      this.prisma.class.findUnique({ where: { id: dto.classId, tenantId } }),
    ]);
    if (!subject) throw new NotFoundException('Subject not found');
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.$transaction(async (tx) => {
      let assignment;
      try {
        assignment = await tx.teacherSubject.create({
          data: { tenantId, teacherId, subjectId: dto.subjectId, classId: dto.classId },
          include: { subject: true, class: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Teacher already teaches this subject in this class');
        }
        throw err;
      }

      await tx.classTeacher.upsert({
        where: { classId_teacherId: { classId: dto.classId, teacherId } },
        update: {},
        create: { classId: dto.classId, teacherId, isClassTeacher: false },
      });

      return assignment;
    });
  }

  async removeSubject(tenantId: string, teacherId: string, assignmentId: string) {
    const assignment = await this.prisma.teacherSubject.findUnique({
      where: { id: assignmentId, tenantId, teacherId },
    });
    if (!assignment) throw new NotFoundException('Subject assignment not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherSubject.delete({ where: { id: assignmentId } });

      const remaining = await tx.teacherSubject.count({
        where: { teacherId, classId: assignment.classId },
      });
      if (remaining === 0) {
        const classTeacher = await tx.classTeacher.findUnique({
          where: { classId_teacherId: { classId: assignment.classId, teacherId } },
        });
        // Only drop the class-access row if it was never explicitly designated as
        // "the" class teacher — that designation is managed separately.
        if (classTeacher && !classTeacher.isClassTeacher) {
          await tx.classTeacher.delete({
            where: { classId_teacherId: { classId: assignment.classId, teacherId } },
          });
        }
      }
    });
  }

  private async requireTeacher(tenantId: string, teacherId: string) {
    const teacher = await this.prisma.user.findUnique({ where: { id: teacherId, tenantId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.role !== Role.teacher) throw new BadRequestException('User is not a teacher');
    return teacher;
  }
}
