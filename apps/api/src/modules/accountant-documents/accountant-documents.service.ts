import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateAccountantDocumentDto } from './dto/create-accountant-document.dto';

const documentInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.AccountantDocumentInclude;

@Injectable()
export class AccountantDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  findAll(tenantId: string) {
    return this.prisma.accountantDocument.findMany({
      where: { tenantId },
      include: documentInclude,
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async create(tenantId: string, uploadedBy: string, dto: CreateAccountantDocumentDto) {
    const category = await this.prisma.documentCategory.findUnique({
      where: { id: dto.categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Document category not found');

    // Confirms the key belongs to this tenant and the object actually exists in S3.
    await this.filesService.getSignedUrl(dto.fileKey, tenantId);

    return this.prisma.accountantDocument.create({
      data: {
        tenantId,
        uploadedBy,
        fileKey: dto.fileKey,
        categoryId: dto.categoryId,
        note: dto.note ?? null,
      },
      include: documentInclude,
    });
  }

  async getSignedUrl(tenantId: string, id: string) {
    const doc = await this.prisma.accountantDocument.findUnique({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.filesService.getSignedUrl(doc.fileKey, tenantId);
  }

  async remove(tenantId: string, id: string) {
    const doc = await this.prisma.accountantDocument.findUnique({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.prisma.accountantDocument.delete({ where: { id } });
  }
}
