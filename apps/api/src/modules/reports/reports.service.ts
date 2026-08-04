import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, Role, ReportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';

const reportInclude = {
  student: { select: { id: true, name: true, admissionNo: true } },
  class: { select: { id: true, name: true, academicYear: true } },
  teacher: { select: { id: true, name: true } },
  _count: { select: { readReceipts: true } },
} satisfies Prisma.ReportInclude;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateReportDto, user: ActiveUser) {
    // Validate the student exists in the tenant and belongs to the teacher's class
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId, tenantId },
      select: { id: true, classId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cls = await this.prisma.class.findUnique({
      where: { id: student.classId, tenantId },
      select: { id: true, teacherId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.teacherId !== user.id) {
      throw new ForbiddenException('You can only create reports for students in your class');
    }

    return this.prisma.report.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        classId: student.classId,
        teacherId: user.id,
        type: dto.type,
        term: dto.term,
        academicYear: dto.academicYear,
        content: dto.content as Prisma.InputJsonValue,
      },
      include: reportInclude,
    });
  }

  async findAll(tenantId: string, user: ActiveUser, query: ReportQueryDto) {
    const where = await this.buildListWhere(tenantId, user, query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.report.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.prisma.report.findUnique({
      where: { id, tenantId },
      include: reportInclude,
    });
    if (!report) throw new NotFoundException('Report not found');

    await this.assertReadAccess(tenantId, report, user);
    return report;
  }

  async update(tenantId: string, id: string, dto: UpdateReportDto, user: ActiveUser) {
    const report = await this.requireReport(tenantId, id);
    this.assertTeacherOwns(report, user);
    if (report.status !== ReportStatus.draft) {
      throw new BadRequestException('Only draft reports can be edited');
    }

    return this.prisma.report.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.term !== undefined && { term: dto.term }),
        ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
      },
      include: reportInclude,
    });
  }

  async publish(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.requireReport(tenantId, id);
    this.assertTeacherOwns(report, user);
    if (report.status === ReportStatus.published) {
      throw new ConflictException('Report is already published');
    }

    return this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.published, publishedAt: new Date() },
      include: reportInclude,
    });
  }

  async remove(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.requireReport(tenantId, id);

    if (user.role === Role.teacher) {
      this.assertTeacherOwns(report, user);
    }
    if (report.status !== ReportStatus.draft) {
      throw new BadRequestException('Only draft reports can be deleted');
    }

    await this.prisma.report.delete({ where: { id } });
  }

  async markRead(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.requireReport(tenantId, id);

    if (report.status !== ReportStatus.published) {
      throw new BadRequestException('Cannot mark an unpublished report as read');
    }

    // Verify parent has access to this student (invariant #2)
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId: report.studentId, parentId: user.id } },
    });
    if (!link) throw new NotFoundException('Report not found');

    await this.prisma.reportReadReceipt.upsert({
      where: { reportId_userId: { reportId: id, userId: user.id } },
      create: { reportId: id, userId: user.id },
      update: { readAt: new Date() },
    });

    return { reportId: id, readAt: new Date() };
  }

  async getReadReceipts(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.requireReport(tenantId, id);

    // Teachers can only see receipts for their own reports
    if (user.role === Role.teacher && report.teacherId !== user.id) {
      throw new NotFoundException('Report not found');
    }

    return this.prisma.reportReadReceipt.findMany({
      where: { reportId: id },
      include: {
        report: {
          select: {
            student: {
              select: {
                parents: {
                  where: { parentId: { not: undefined } },
                  include: { parent: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { readAt: 'desc' },
    });
  }

  private async buildListWhere(
    tenantId: string,
    user: ActiveUser,
    query: ReportQueryDto,
  ): Promise<Prisma.ReportWhereInput> {
    const where: Prisma.ReportWhereInput = { tenantId };

    if (query.type) where.type = query.type;
    if (query.academicYear) where.academicYear = query.academicYear;
    if (query.term) where.term = query.term;

    if (user.role === Role.parent) {
      // Parents only see published reports for their linked children
      where.status = ReportStatus.published;
      where.student = { parents: { some: { parentId: user.id } } };
      if (query.studentId) where.studentId = query.studentId;
    } else if (user.role === Role.teacher) {
      // Teachers only see reports for students in their class
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teacherId: user.id },
        select: { id: true },
      });
      where.classId = { in: teacherClasses.map((c) => c.id) };
      if (query.studentId) where.studentId = query.studentId;
      if (query.classId) where.classId = query.classId;
      if (query.status) where.status = query.status;
    } else {
      // admin / accounts — see everything
      if (query.studentId) where.studentId = query.studentId;
      if (query.classId) where.classId = query.classId;
      if (query.status) where.status = query.status;
    }

    return where;
  }

  private async assertReadAccess(
    tenantId: string,
    report: { studentId: string; teacherId: string; status: ReportStatus; classId: string },
    user: ActiveUser,
  ) {
    if (user.role === Role.parent) {
      if (report.status !== ReportStatus.published) {
        throw new NotFoundException('Report not found');
      }
      const link = await this.prisma.studentParent.findUnique({
        where: { studentId_parentId: { studentId: report.studentId, parentId: user.id } },
      });
      if (!link) throw new NotFoundException('Report not found');
    } else if (user.role === Role.teacher) {
      // Teacher must own the class this report belongs to
      const cls = await this.prisma.class.findUnique({
        where: { id: report.classId, tenantId },
        select: { teacherId: true },
      });
      if (cls?.teacherId !== user.id) throw new NotFoundException('Report not found');
    }
    // admin / accounts can read everything
  }

  private assertTeacherOwns(
    report: { teacherId: string },
    user: ActiveUser,
  ) {
    if (report.teacherId !== user.id) {
      throw new ForbiddenException('You can only modify your own reports');
    }
  }

  private async requireReport(tenantId: string, id: string) {
    const r = await this.prisma.report.findUnique({ where: { id, tenantId } });
    if (!r) throw new NotFoundException('Report not found');
    return r;
  }
}
