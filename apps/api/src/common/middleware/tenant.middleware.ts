import {
  Injectable,
  NestMiddleware,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { subscriptionState } from '../subscription';
import { fromDbDate, todayIn } from '../../modules/attendance/attendance-dates';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly jwt: JwtService;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.jwt = new JwtService({
      secret: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async use(
    req: Request & { tenantId?: string },
    _res: Response,
    next: NextFunction,
  ) {
    const tenantId =
      (req.headers['x-tenant-id'] as string) ??
      this.extractFromSubdomain(req.hostname);

    if (!tenantId) {
      throw new BadRequestException('X-Tenant-ID header is required');
    }

    // Accept both UUID (id) and slug for flexibility during onboarding
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tenantId,
      );
    const tenant = await this.prisma.tenant.findUnique({
      where: isUuid
        ? { id: tenantId, isActive: true }
        : { slug: tenantId, isActive: true },
      select: {
        id: true,
        timezone: true,
        subscriptionEndsOn: true,
        onTrial: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: 'SCHOOL_NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    // Past the grace period without a renewal the school is switched off
    // (docs/SPEC-subscriptions.md). The platform team can still work in it.
    const { status } = subscriptionState(
      fromDbDate(tenant.subscriptionEndsOn),
      todayIn(tenant.timezone || 'Asia/Kolkata'),
      tenant.onTrial,
    );
    if (status === 'expired' && !this.isSuperAdmin(req)) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_EXPIRED',
        message:
          "This school's Schoolinkd subscription has ended. Please contact the school office.",
      });
    }

    req.tenantId = tenant.id;
    next();
  }

  /** A valid (signed, unexpired) super_admin access token on the request. */
  private isSuperAdmin(req: Request): boolean {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return false;
    try {
      const payload = this.jwt.verify<{ role?: string }>(auth.slice(7));
      return payload.role === Role.super_admin;
    } catch {
      return false;
    }
  }

  private extractFromSubdomain(hostname: string): string | undefined {
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0];
    }
    return undefined;
  }
}
