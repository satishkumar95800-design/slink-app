import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Every HR & payroll endpoint answers 403 FEATURE_DISABLED unless the platform
 * team switched `hrms` on for the school. Runs after the global JWT and roles
 * guards, so only permitted roles ever reach the check.
 */
@Injectable()
export class HrmsFeatureGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { tenantId } = context
      .switchToHttp()
      .getRequest<{ tenantId: string }>();
    await assertFeatureEnabled(this.prisma, tenantId, 'hrms');
    return true;
  }
}
