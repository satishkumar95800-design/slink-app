import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformDashboardService } from './platform-dashboard.service';

/** Excluded from TenantMiddleware: the platform team has no school context. */
@Controller('platform')
@Roles(Role.super_admin)
export class PlatformDashboardController {
  constructor(private readonly dashboard: PlatformDashboardService) {}

  @Get('dashboard')
  get() {
    return this.dashboard.dashboard();
  }
}
