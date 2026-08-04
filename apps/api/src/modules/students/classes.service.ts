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

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, user: ActiveUser) {
    const where =
      user.role === Role.teacher
        ? { tenantId, teacherId: user.id }
        : { tenantId };

    return this.prisma.class.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        academicYear: true,
        teacherId: true,
        _count: { select: { students: true } },
      },
    });
  }

  async findOne(tenantId: string, classId: string, user: ActiveUser) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
      include: { _count: { select: { students: true } } },
    });

    if (!cls) throw new NotFoundException('Class not found');

    if (user.role === Role.teacher && cls.teacherId !== user.id) {
      throw new ForbiddenException('You are not assigned to this class');
    }

    return cls;
  }

  async create(tenantId: string, dto: CreateClassDto) {
    const existing = await this.prisma.class.findUnique({
      where: { tenantId_name_academicYear: { tenantId, name: dto.name, academicYear: dto.academicYear } },
    });
    if (existing) throw new ConflictException('A class with this name already exists for this academic year');

    return this.prisma.class.create({
      data: { tenantId, name: dto.name, academicYear: dto.academicYear },
    });
  }

  async update(tenantId: string, classId: string, dto: UpdateClassDto) {
    await this.requireClass(tenantId, classId);

    if (dto.teacherId) {
      const teacher = await this.prisma.user.findUnique({
        where: { id: dto.teacherId, tenantId },
        select: { role: true },
      });
      if (!teacher || teacher.role !== Role.teacher) {
        throw new NotFoundException('Teacher not found');
      }
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: { name: dto.name, teacherId: dto.teacherId },
    });
  }

  async remove(tenantId: string, classId: string) {
    const cls = await this.requireClass(tenantId, classId);

    const studentCount = await this.prisma.student.count({ where: { classId, tenantId } });
    if (studentCount > 0) {
      throw new ConflictException(`Cannot delete class: ${studentCount} student(s) still assigned`);
    }

    await this.prisma.class.delete({ where: { id: cls.id } });
  }

  private async requireClass(tenantId: string, classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId, tenantId } });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }
}
