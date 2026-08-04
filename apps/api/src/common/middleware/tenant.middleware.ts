import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request & { tenantId?: string }, _res: Response, next: NextFunction) {
    const tenantId =
      (req.headers['x-tenant-id'] as string) ?? this.extractFromSubdomain(req.hostname);

    if (!tenantId) {
      throw new BadRequestException('X-Tenant-ID header is required');
    }

    // Accept both UUID (id) and slug for flexibility during onboarding
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenantId,
    );
    const tenant = await this.prisma.tenant.findUnique({
      where: isUuid ? { id: tenantId, isActive: true } : { slug: tenantId, isActive: true },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    req.tenantId = tenant.id;
    next();
  }

  private extractFromSubdomain(hostname: string): string | undefined {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return undefined;
  }
}
