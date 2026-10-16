import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Type,
  mixin,
} from '@nestjs/common';
import { assertFeatureEnabled, OptionalFeature } from '../tenant-features';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * `@UseGuards(FeatureGuard('timetable'))`: the routes answer 403
 * FEATURE_DISABLED unless the platform team switched the flag on for the
 * school. Runs after the global JWT and roles guards.
 */
export function FeatureGuard(feature: OptionalFeature): Type<CanActivate> {
  @Injectable()
  class TenantFeatureGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const { tenantId } = context
        .switchToHttp()
        .getRequest<{ tenantId: string }>();
      await assertFeatureEnabled(this.prisma, tenantId, feature);
      return true;
    }
  }
  return mixin(TenantFeatureGuard);
}
