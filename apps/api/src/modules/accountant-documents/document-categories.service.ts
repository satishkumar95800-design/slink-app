import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentCategoryDto } from './dto/create-document-category.dto';
import { UpdateDocumentCategoryDto } from './dto/update-document-category.dto';

@Injectable()
export class DocumentCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.documentCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateDocumentCategoryDto) {
    const existing = await this.prisma.documentCategory.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Document category "${dto.name}" already exists`);

    return this.prisma.documentCategory.create({ data: { tenantId, name: dto.name } });
  }

  async update(tenantId: string, id: string, dto: UpdateDocumentCategoryDto) {
    await this.requireCategory(tenantId, id);

    return this.prisma.documentCategory.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }) },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.requireCategory(tenantId, id);

    const assignedCount = await this.prisma.accountantDocument.count({ where: { categoryId: id } });
    if (assignedCount > 0) {
      throw new ConflictException(
        `Cannot delete: this category is used by ${assignedCount} document(s)`,
      );
    }

    await this.prisma.documentCategory.delete({ where: { id } });
  }

  private async requireCategory(tenantId: string, id: string) {
    const c = await this.prisma.documentCategory.findUnique({ where: { id, tenantId } });
    if (!c) throw new NotFoundException('Document category not found');
    return c;
  }
}
