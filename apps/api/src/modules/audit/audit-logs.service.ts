import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

/** Cross-tenant by design, like TenantsService — no implicit tenant filter. */
@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const enriched = await this.enrichWithNames(data);

    return { data: enriched, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /** AuditLog has no Prisma relations to User/Tenant (deliberately loose so it survives entity deletion) — resolve names for just this page's rows. */
  private async enrichWithNames(rows: { actorId: string; tenantId: string | null }[]) {
    const actorIds = [...new Set(rows.map((r) => r.actorId))];
    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((id): id is string => !!id))];

    const [actors, tenants] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true, role: true },
      }),
      this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, slug: true },
      }),
    ]);

    const actorMap = new Map(actors.map((a) => [a.id, a]));
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    return rows.map((row) => ({
      ...row,
      actor: actorMap.get(row.actorId) ?? null,
      tenant: row.tenantId ? (tenantMap.get(row.tenantId) ?? null) : null,
    }));
  }
}
