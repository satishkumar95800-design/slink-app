import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** What a school's staff see of head office circulars (dashboard card). */
@Injectable()
export class CircularsService {
  constructor(private readonly prisma: PrismaService) {}

  async forSchool(tenantId: string) {
    const rows = await this.prisma.groupCircularBranch.findMany({
      where: { tenantId },
      orderBy: { circular: { createdAt: 'desc' } },
      take: 20,
      include: {
        circular: { include: { group: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.circular.id,
      title: r.circular.title,
      body: r.circular.body,
      audience: r.circular.audience,
      from: r.circular.group.name,
      createdAt: r.circular.createdAt,
    }));
  }
}
