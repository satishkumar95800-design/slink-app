import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Every petty-cash endpoint answers 403 FEATURE_DISABLED unless the platform
 * team switched `pettyCash` on for the school. Runs after the global JWT and
 * roles guards, so only admin/accounts ever reach the check.
 */
@Injectable()
export class PettyCashFeatureGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { tenantId } = context
      .switchToHttp()
      .getRequest<{ tenantId: string }>();
    await assertFeatureEnabled(this.prisma, tenantId, 'pettyCash');
    return true;
  }
}
