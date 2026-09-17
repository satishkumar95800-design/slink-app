import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransportSlabDto } from './dto/create-transport-slab.dto';
import { UpdateTransportSlabDto } from './dto/update-transport-slab.dto';

@Injectable()
export class TransportSlabsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.transportSlab.findMany({
      where: { tenantId },
      orderBy: { minDistanceKm: 'asc' },
    });
  }

  create(tenantId: string, dto: CreateTransportSlabDto) {
    return this.prisma.transportSlab.create({
      data: {
        tenantId,
        minDistanceKm: new Prisma.Decimal(dto.minDistanceKm.toFixed(2)),
        maxDistanceKm: new Prisma.Decimal(dto.maxDistanceKm.toFixed(2)),
        monthlyAmount: new Prisma.Decimal(dto.monthlyAmount.toFixed(2)),
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTransportSlabDto) {
    await this.requireSlab(tenantId, id);

    return this.prisma.transportSlab.update({
      where: { id },
      data: {
        ...(dto.minDistanceKm !== undefined && {
          minDistanceKm: new Prisma.Decimal(dto.minDistanceKm.toFixed(2)),
        }),
        ...(dto.maxDistanceKm !== undefined && {
          maxDistanceKm: new Prisma.Decimal(dto.maxDistanceKm.toFixed(2)),
        }),
        ...(dto.monthlyAmount !== undefined && {
          monthlyAmount: new Prisma.Decimal(dto.monthlyAmount.toFixed(2)),
        }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.requireSlab(tenantId, id);
    await this.prisma.transportSlab.delete({ where: { id } });
  }

  private async requireSlab(tenantId: string, id: string) {
    const s = await this.prisma.transportSlab.findUnique({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Transport slab not found');
    return s;
  }
}
