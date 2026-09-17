import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';

@Injectable()
export class CustomFieldDefinitionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.customFieldDefinition.findMany({
      where: { tenantId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateCustomFieldDefinitionDto) {
    const existing = await this.prisma.customFieldDefinition.findUnique({
      where: { tenantId_label: { tenantId, label: dto.label } },
    });
    if (existing) throw new ConflictException(`Custom field "${dto.label}" already exists`);

    return this.prisma.customFieldDefinition.create({
      data: {
        tenantId,
        label: dto.label,
        fieldType: dto.fieldType,
        options: dto.options ? (dto.options as Prisma.InputJsonValue) : undefined,
        isSensitive: dto.isSensitive ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomFieldDefinitionDto) {
    await this.requireDefinition(tenantId, id);

    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.options !== undefined && { options: dto.options as Prisma.InputJsonValue }),
        ...(dto.isSensitive !== undefined && { isSensitive: dto.isSensitive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.requireDefinition(tenantId, id);
    await this.prisma.customFieldDefinition.delete({ where: { id } });
  }

  private async requireDefinition(tenantId: string, id: string) {
    const d = await this.prisma.customFieldDefinition.findUnique({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Custom field definition not found');
    return d;
  }
}
