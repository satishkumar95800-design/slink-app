import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Roles(Role.teacher)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(tenantId, dto, user);
  }

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.findAll(tenantId, user, query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.findOne(tenantId, id, user);
  }

  @Patch(':id')
  @Roles(Role.teacher)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.update(tenantId, id, dto, user);
  }

  @Post(':id/publish')
  @Roles(Role.teacher)
  @HttpCode(HttpStatus.OK)
  publish(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.publish(tenantId, id, user);
  }

  @Delete(':id')
  @Roles(Role.admin, Role.teacher)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.remove(tenantId, id, user);
  }

  @Post(':id/read')
  @Roles(Role.parent)
  @HttpCode(HttpStatus.OK)
  markRead(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.markRead(tenantId, id, user);
  }

  @Get(':id/read-receipts')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  getReadReceipts(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reportsService.getReadReceipts(tenantId, id, user);
  }
}
