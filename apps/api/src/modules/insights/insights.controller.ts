import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { InsightsService } from './insights.service';
import { InsightsQueryDto } from './dto/insights-query.dto';

/**
 * Admin/accountant/teacher analytics reports — distinct from /reports, which is
 * the teacher-to-parent progress-report feature. "Students in a class" has no
 * route here; the web-admin report picker calls GET /students?classId= directly.
 */
@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('fee-pending')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  async feePending(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: InsightsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.insightsService.getFeePending(tenantId, user, query);
    return this.respond(res, query, result.data, 'fee-pending');
  }

  @Get('paid-history')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  async paidHistory(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: InsightsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.insightsService.getPaidHistory(tenantId, user, query);
    return this.respond(res, query, result.data, 'paid-history');
  }

  @Get('defaulters')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  async defaulters(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: InsightsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.insightsService.getDefaulters(tenantId, user, query);
    return this.respond(res, query, result.data, 'defaulters');
  }

  @Get('class-collection-summary')
  @Roles(Role.admin, Role.accounts, Role.super_admin)
  classCollectionSummary(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: InsightsQueryDto,
  ) {
    return this.insightsService.getClassCollectionSummary(tenantId, user, query);
  }

  @Get('collection-register')
  @Roles(Role.admin, Role.accounts, Role.super_admin)
  collectionRegister(@TenantId() tenantId: string, @Query() query: InsightsQueryDto) {
    return this.insightsService.getCollectionRegister(tenantId, query);
  }

  private respond(res: Response, query: InsightsQueryDto, data: unknown[], filename: string) {
    if (query.format === 'csv') {
      const csv = this.insightsService.toCsv(data as Record<string, unknown>[]);
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}.csv"`,
      });
      return csv;
    }
    return { data };
  }
}
