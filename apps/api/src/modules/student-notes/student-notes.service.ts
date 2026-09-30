import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateStudentNoteDto } from './dto/create-student-note.dto';
import { StudentNoteQueryDto } from './dto/student-note-query.dto';

const studentNoteInclude = {
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.StudentNoteInclude;

@Injectable()
export class StudentNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateStudentNoteDto, user: ActiveUser) {
    await this.assertAccess(tenantId, dto.studentId, user);

    return this.prisma.studentNote.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        authorId: user.id,
        type: dto.type,
        content: dto.content,
      },
      include: studentNoteInclude,
    });
  }

  async findForStudent(tenantId: string, query: StudentNoteQueryDto, user: ActiveUser) {
    await this.assertAccess(tenantId, query.studentId, user);

    return this.prisma.studentNote.findMany({
      where: {
        tenantId,
        studentId: query.studentId,
        ...(query.type && { type: query.type }),
      },
      include: studentNoteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** admin/super_admin are unrestricted; a teacher must own the student's class. */
  private async assertAccess(tenantId: string, studentId: string, user: ActiveUser) {
    if (user.role === Role.admin || user.role === Role.super_admin) return;

    const student = await this.prisma.student.findUnique({
      where: { id: studentId, tenantId },
      select: { classId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cls = await this.prisma.class.findUnique({
      where: { id: student.classId, tenantId },
      select: { teachers: { select: { teacherId: true } } },
    });
    if (!cls?.teachers.some((t) => t.teacherId === user.id)) {
      throw new ForbiddenException('You can only access notes for students in your own class');
    }
  }
}
