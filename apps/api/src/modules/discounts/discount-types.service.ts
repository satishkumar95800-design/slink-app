import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiscountTypeDto } from './dto/create-discount-type.dto';
import { UpdateDiscountTypeDto } from './dto/update-discount-type.dto';

@Injectable()
export class DiscountTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.discountType.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateDiscountTypeDto) {
    const existing = await this.prisma.discountType.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Discount type "${dto.name}" already exists`);

    return this.prisma.discountType.create({
      data: { tenantId, name: dto.name, kind: dto.kind },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateDiscountTypeDto) {
    await this.requireDiscountType(tenantId, id);

    return this.prisma.discountType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.kind !== undefined && { kind: dto.kind }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.requireDiscountType(tenantId, id);

    const assignedCount = await this.prisma.studentDiscount.count({
      where: { discountTypeId: id },
    });
    if (assignedCount > 0) {
      throw new ConflictException(
        `Cannot delete: this discount type is assigned to ${assignedCount} student(s)`,
      );
    }

    await this.prisma.discountType.delete({ where: { id } });
  }

  private async requireDiscountType(tenantId: string, id: string) {
    const d = await this.prisma.discountType.findUnique({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Discount type not found');
    return d;
  }
}
