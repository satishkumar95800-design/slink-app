import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertsService } from './alerts.service';

/** Premium pattern warnings (docs/SPEC-ai.md phase 2). */
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher)
  async list(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    return this.alerts.listOpen(tenantId, user);
  }

  @Get('summary')
  @Roles(Role.admin)
  async summary(@TenantId() tenantId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    return { summary: await this.alerts.latestSummary(tenantId) };
  }

  /** Recompute now instead of waiting for the morning run. */
  @Post('run')
  @Roles(Role.admin)
  async run(@TenantId() tenantId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    return this.alerts.runForTenant(tenantId);
  }

  @Post(':id/dismiss')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alerts.dismiss(tenantId, id, user);
  }
}
