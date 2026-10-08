import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NotificationChannel, Prisma, Role, ReportStatus, ReportType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
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

/** Homework photo links handed to the app last an hour; they're re-signed on every read. */
const HOMEWORK_PHOTO_URL_TTL_SECONDS = 60 * 60;

const publishedPush = {
  title: (type: ReportType) => (type === ReportType.report_card ? 'Report card published' : 'New progress report'),
  body: (firstName: string, type: ReportType) =>
    type === ReportType.report_card
      ? `${firstName}'s report card is ready to view.`
      : `A new progress report for ${firstName} is ready to view.`,
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Homework content stores the photo's S3 key (older rows only a 24h signed
   * URL, from which the key is recovered). Returns a freshly signed URL, or the
   * stored one if no key can be found.
   */
  async homeworkAttachmentUrl(tenantId: string, content: Prisma.JsonValue): Promise<string | null> {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
    const stored = typeof content.attachmentUrl === 'string' ? content.attachmentUrl : null;
    const key = typeof content.fileKey === 'string' ? content.fileKey : stored ? this.files.keyFromUrl(stored) : null;
    if (!key) return stored;
    try {
      return await this.files.getSignedUrl(key, tenantId, HOMEWORK_PHOTO_URL_TTL_SECONDS, { verifyExists: false });
    } catch {
      return stored;
    }
  }

  private async withFreshAttachment<T extends { type: ReportType; content: Prisma.JsonValue }>(tenantId: string, report: T): Promise<T> {
    if (report.type !== ReportType.homework) return report;
    const attachmentUrl = await this.homeworkAttachmentUrl(tenantId, report.content);
    const content = report.content && typeof report.content === 'object' && !Array.isArray(report.content) ? report.content : {};
    return { ...report, content: { ...content, attachmentUrl } };
  }

  async create(tenantId: string, dto: CreateReportDto, user: ActiveUser) {
    // Validate the student exists in the tenant and belongs to the teacher's class
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId, tenantId },
      select: { id: true, classId: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const cls = await this.prisma.class.findUnique({
      where: { id: student.classId, tenantId },
      select: { id: true, teachers: { select: { teacherId: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (!cls.teachers.some((t) => t.teacherId === user.id)) {
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

    return {
      data: await Promise.all(data.map((r) => this.withFreshAttachment(tenantId, r))),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const report = await this.prisma.report.findUnique({
      where: { id, tenantId },
      include: reportInclude,
    });
    if (!report) throw new NotFoundException('Report not found');

    await this.assertReadAccess(tenantId, report, user);
    return this.withFreshAttachment(tenantId, report);
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
        ...(dto.pdfKey !== undefined && { pdfKey: dto.pdfKey }),
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

    const published = await this.prisma.report.update({
      where: { id },
      data: { status: ReportStatus.published, publishedAt: new Date() },
      include: reportInclude,
    });
    await this.notifyParentsOfPublish(tenantId, published);
    return published;
  }

  /** Report cards and progress reports push to the student's parents; homework has its own push at send time. */
  private async notifyParentsOfPublish(
    tenantId: string,
    report: { id: string; type: ReportType; student: { id: string; name: string } },
  ) {
    if (report.type === ReportType.homework) return;
    const parents = await this.prisma.studentParent.findMany({
      where: { studentId: report.student.id },
      select: { parentId: true },
    });
    const firstName = report.student.name.trim().split(/\s+/)[0];
    await Promise.all(
      parents.map((p) =>
        this.notifications
          .send({
            tenantId,
            userId: p.parentId,
            channel: NotificationChannel.fcm,
            title: publishedPush.title(report.type),
            body: publishedPush.body(firstName, report.type),
            data: { type: 'report_published', reportId: report.id, studentId: report.student.id },
          })
          .catch((err) => this.logger.warn(`Report push to ${p.parentId} failed: ${(err as Error).message}`)),
      ),
    );
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
        where: { tenantId, teachers: { some: { teacherId: user.id } } },
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
        select: { teachers: { select: { teacherId: true } } },
      });
      if (!cls?.teachers.some((t) => t.teacherId === user.id)) {
        throw new NotFoundException('Report not found');
      }
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
