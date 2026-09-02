import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, Role, GuardianRelation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActiveUser } from '../../common/types/active-user.type';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto';

// Reusable include shape for student queries
const studentInclude = {
  class: { select: { id: true, name: true, academicYear: true } },
  parents: {
    select: {
      relation: true,
      isPrimary: true,
      parent: { select: { id: true, name: true, phone: true, profession: true } },
    },
  },
} satisfies Prisma.StudentInclude;

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, user: ActiveUser, query: StudentQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = await this.buildListWhere(tenantId, user, query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        include: studentInclude,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.student.count({ where }),
    ]);

    return {
      data: data.map((s) => this.sanitiseForRole(s, user)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Shortcut for parents — returns only their own linked children. */
  async findMyChildren(tenantId: string, parentId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { parentId, student: { tenantId } },
      include: {
        student: { include: studentInclude },
      },
    });
    return links.map((l) => l.student);
  }

  // ─── Get one ─────────────────────────────────────────────────────────────────

  async findOne(tenantId: string, studentId: string, user: ActiveUser) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId, tenantId },
      include: studentInclude,
    });

    if (!student) throw new NotFoundException('Student not found');

    await this.assertAccess(student, user);

    return this.sanitiseForRole(student, user);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateStudentDto) {
    await this.requireClass(tenantId, dto.classId);

    const existing = await this.prisma.student.findUnique({
      where: { tenantId_admissionNo: { tenantId, admissionNo: dto.admissionNo } },
    });
    if (existing) throw new ConflictException(`Admission number "${dto.admissionNo}" is already in use`);

    const student = await this.prisma.student.create({
      data: {
        tenantId,
        name: dto.name,
        admissionNo: dto.admissionNo,
        dob: dto.dob ? new Date(dto.dob) : null,
        bloodGroup: dto.bloodGroup ?? null,
        caste: dto.caste ?? null,
        photoUrl: dto.photoUrl ?? null,
        classId: dto.classId,
      },
      include: studentInclude,
    });

    if (dto.parentPhone) {
      await this.linkParentByPhone(tenantId, student.id, {
        parentPhone: dto.parentPhone,
        relation: dto.parentRelation,
        isPrimary: dto.isParentPrimary ?? true,
      });
    }

    // Re-fetch with the parent link included
    return this.prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      include: studentInclude,
    });
  }

  // ─── Bulk create ─────────────────────────────────────────────────────────────

  async bulkCreate(tenantId: string, dto: BulkCreateStudentsDto) {
    const results: Array<{ index: number; student?: unknown; error?: string }> = [];

    for (let i = 0; i < dto.students.length; i++) {
      try {
        const student = await this.create(tenantId, dto.students[i]);
        results.push({ index: i, student });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ index: i, error: message });
      }
    }

    return {
      created: results.filter((r) => r.student).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(tenantId: string, studentId: string, dto: UpdateStudentDto) {
    await this.requireStudent(tenantId, studentId);

    if (dto.classId) await this.requireClass(tenantId, dto.classId);

    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        name: dto.name,
        classId: dto.classId,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        bloodGroup: dto.bloodGroup,
        caste: dto.caste,
        photoUrl: dto.photoUrl,
      },
      include: studentInclude,
    });
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async remove(tenantId: string, studentId: string) {
    await this.requireStudent(tenantId, studentId);
    await this.prisma.student.delete({ where: { id: studentId } });
  }

  // ─── Parent linkage ──────────────────────────────────────────────────────────

  async linkParent(tenantId: string, studentId: string, dto: LinkParentDto) {
    await this.requireStudent(tenantId, studentId);
    return this.linkParentByPhone(tenantId, studentId, dto);
  }

  async unlinkParent(tenantId: string, studentId: string, parentId: string) {
    await this.requireStudent(tenantId, studentId);

    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId } },
    });
    if (!link) throw new NotFoundException('Parent link not found');

    await this.prisma.studentParent.delete({
      where: { studentId_parentId: { studentId, parentId } },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Look up a parent user by phone number. If one doesn't exist yet, create an
   * unverified record so the link is ready when they first log in via OTP.
   * Then create the StudentParent join.
   */
  private async linkParentByPhone(
    tenantId: string,
    studentId: string,
    dto: { parentPhone: string; relation?: GuardianRelation; isPrimary?: boolean },
  ) {
    let parent = await this.prisma.user.findUnique({
      where: { tenantId_phone: { tenantId, phone: dto.parentPhone } },
    });

    if (!parent) {
      parent = await this.prisma.user.create({
        data: {
          tenantId,
          phone: dto.parentPhone,
          name: 'Parent',
          role: Role.parent,
          isVerified: false,
        },
      });
    }

    const existing = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId: parent.id } },
    });
    if (existing) throw new ConflictException('This parent is already linked to the student');

    return this.prisma.studentParent.create({
      data: {
        studentId,
        parentId: parent.id,
        relation: dto.relation ?? GuardianRelation.guardian,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  private async buildListWhere(
    tenantId: string,
    user: ActiveUser,
    query: StudentQueryDto,
  ): Promise<Prisma.StudentWhereInput> {
    const base: Prisma.StudentWhereInput = { tenantId };

    if (query.search) {
      base.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { admissionNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (user.role === Role.parent) {
      return { ...base, parents: { some: { parentId: user.id } } };
    }

    if (user.role === Role.teacher) {
      // Teacher sees only students in their assigned class(es)
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teacherId: user.id },
        select: { id: true },
      });
      const classIds = teacherClasses.map((c) => c.id);
      return {
        ...base,
        classId: query.classId
          ? classIds.includes(query.classId)
            ? query.classId
            : 'no-match' // returns empty if queried class isn't theirs
          : { in: classIds },
      };
    }

    // admin / accounts: all students in tenant, optional class filter
    if (query.classId) base.classId = query.classId;
    return base;
  }

  private async assertAccess(
    student: { classId: string; parents: Array<{ parent: { id: string } }> },
    user: ActiveUser,
  ) {
    if (user.role === Role.admin || user.role === Role.accounts || user.role === Role.super_admin) {
      return;
    }

    if (user.role === Role.parent) {
      const isLinked = student.parents.some((p) => p.parent.id === user.id);
      if (!isLinked) throw new ForbiddenException('You do not have access to this student');
      return;
    }

    if (user.role === Role.teacher) {
      const cls = await this.prisma.class.findUnique({
        where: { id: student.classId },
        select: { teacherId: true },
      });
      if (cls?.teacherId !== user.id) {
        throw new ForbiddenException('This student is not in your class');
      }
      return;
    }
  }

  /**
   * Strip sensitive parent contact info when returning data to parents, and
   * strip caste (sensitive demographic data) when returning data to teachers.
   * Blood group stays visible to teachers — useful in a medical emergency.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sanitiseForRole(student: any, user: ActiveUser) {
    if (user.role === Role.teacher) {
      const { caste: _caste, ...rest } = student;
      return rest;
    }
    if (user.role !== Role.parent) return student;
    return {
      ...student,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parents: (student.parents as any[]).filter((p) => p.parent.id === user.id),
    };
  }

  private async requireStudent(tenantId: string, studentId: string) {
    const s = await this.prisma.student.findUnique({ where: { id: studentId, tenantId } });
    if (!s) throw new NotFoundException('Student not found');
    return s;
  }

  private async requireClass(tenantId: string, classId: string) {
    const c = await this.prisma.class.findUnique({ where: { id: classId, tenantId } });
    if (!c) throw new NotFoundException('Class not found');
    return c;
  }
}
