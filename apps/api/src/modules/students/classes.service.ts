import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActiveUser } from '../../common/types/active-user.type';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AddClassTeacherDto } from './dto/add-class-teacher.dto';

const classListSelect = {
  id: true,
  name: true,
  section: true,
  academicYear: true,
  teachers: { select: { teacher: { select: { id: true, name: true } } } },
  _count: { select: { students: true } },
} as const;

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, user: ActiveUser) {
    const where =
      user.role === Role.teacher
        ? { tenantId, teachers: { some: { teacherId: user.id } } }
        : { tenantId };

    return this.prisma.class.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { name: 'asc' }, { section: 'asc' }],
      select: classListSelect,
    });
  }

  async findOne(tenantId: string, classId: string, user: ActiveUser) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
      include: {
        teachers: { select: { teacher: { select: { id: true, name: true } } } },
        _count: { select: { students: true } },
      },
    });

    if (!cls) throw new NotFoundException('Class not found');

    if (user.role === Role.teacher && !this.isTeacherOf(cls, user.id)) {
      throw new ForbiddenException('You are not assigned to this class');
    }

    return cls;
  }

  isTeacherOf(cls: { teachers: Array<{ teacher: { id: string } }> }, teacherId: string) {
    return cls.teachers.some((t) => t.teacher.id === teacherId);
  }

  async create(tenantId: string, dto: CreateClassDto) {
    const existing = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: dto.name,
        section: dto.section ?? null,
        academicYear: dto.academicYear,
      },
    });
    if (existing)
      throw new ConflictException(
        'A class with this name and section already exists for this academic year',
      );

    return this.prisma.class.create({
      data: {
        tenantId,
        name: dto.name,
        section: dto.section,
        academicYear: dto.academicYear,
      },
    });
  }

  async update(tenantId: string, classId: string, dto: UpdateClassDto) {
    await this.requireClass(tenantId, classId);

    return this.prisma.class.update({
      where: { id: classId },
      data: { name: dto.name, section: dto.section },
    });
  }

  /** Assign a co-teacher to a class. A class may have more than one teacher. */
  async addTeacher(tenantId: string, classId: string, dto: AddClassTeacherDto) {
    await this.requireClass(tenantId, classId);

    const teacher = await this.prisma.user.findUnique({
      where: { id: dto.teacherId, tenantId },
      select: { role: true },
    });
    if (!teacher || teacher.role !== Role.teacher) {
      throw new NotFoundException('Teacher not found');
    }

    const existing = await this.prisma.classTeacher.findUnique({
      where: { classId_teacherId: { classId, teacherId: dto.teacherId } },
    });
    if (existing) throw new ConflictException('This teacher is already assigned to the class');

    return this.prisma.classTeacher.create({
      data: { classId, teacherId: dto.teacherId },
    });
  }

  async removeTeacher(tenantId: string, classId: string, teacherId: string) {
    await this.requireClass(tenantId, classId);

    const existing = await this.prisma.classTeacher.findUnique({
      where: { classId_teacherId: { classId, teacherId } },
    });
    if (!existing) throw new NotFoundException('Teacher assignment not found');

    await this.prisma.classTeacher.delete({
      where: { classId_teacherId: { classId, teacherId } },
    });
  }

  async remove(tenantId: string, classId: string) {
    const cls = await this.requireClass(tenantId, classId);

    const studentCount = await this.prisma.student.count({
      where: { classId, tenantId },
    });
    if (studentCount > 0) {
      throw new ConflictException(
        `Cannot delete class: ${studentCount} student(s) still assigned`,
      );
    }

    await this.prisma.class.delete({ where: { id: cls.id } });
  }

  private async requireClass(tenantId: string, classId: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }
}
