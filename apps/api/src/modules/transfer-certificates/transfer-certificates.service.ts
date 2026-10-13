import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { AttachTransferCertificateDto } from './dto/attach-transfer-certificate.dto';
import { TransferCertificateQueryDto } from './dto/transfer-certificate-query.dto';

/** Transfer certificates (features.transferCertificate): one file per student. */
@Injectable()
export class TransferCertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Students with / without a TC, plus both counts for the report header. */
  async list(tenantId: string, query: TransferCertificateQueryDto) {
    await assertFeatureEnabled(this.prisma, tenantId, 'transferCertificate');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const base: Prisma.StudentWhereInput = {
      tenantId,
      ...(query.classId ? { classId: query.classId } : {}),
    };
    const where: Prisma.StudentWhereInput = {
      ...base,
      tcFileKey: query.status === 'attached' ? { not: null } : null,
    };

    const [data, total, attached, missing] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        select: {
          id: true,
          name: true,
          admissionNo: true,
          tcFileKey: true,
          tcUploadedAt: true,
          class: { select: { id: true, name: true, section: true } },
        },
        orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.student.count({ where }),
      this.prisma.student.count({
        where: { ...base, tcFileKey: { not: null } },
      }),
      this.prisma.student.count({ where: { ...base, tcFileKey: null } }),
    ]);

    return {
      counts: { attached, missing },
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async attach(
    tenantId: string,
    studentId: string,
    dto: AttachTransferCertificateDto,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'transferCertificate');
    await this.requireStudent(tenantId, studentId);
    // Only a file uploaded for this student (files.service buildKey) may be attached.
    if (
      !dto.fileKey.startsWith(`private/${tenantId}/students/${studentId}/tc/`)
    ) {
      throw new BadRequestException(
        'fileKey is not a transfer certificate for this student',
      );
    }
    return this.prisma.student.update({
      where: { id: studentId },
      data: { tcFileKey: dto.fileKey, tcUploadedAt: new Date() },
      select: { id: true, tcFileKey: true, tcUploadedAt: true },
    });
  }

  async remove(tenantId: string, studentId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'transferCertificate');
    await this.requireStudent(tenantId, studentId);
    await this.prisma.student.update({
      where: { id: studentId },
      data: { tcFileKey: null, tcUploadedAt: null },
    });
  }

  private async requireStudent(tenantId: string, studentId: string) {
    const s = await this.prisma.student.findUnique({
      where: { id: studentId, tenantId },
      select: { id: true },
    });
    if (!s) throw new NotFoundException('Student not found');
  }
}
