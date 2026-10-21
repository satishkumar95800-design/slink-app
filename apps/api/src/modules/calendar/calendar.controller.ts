import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarService } from './calendar.service';
import {
  CalendarQueryDto,
  CreateEventDto,
  EventQueryDto,
} from './dto/calendar.dto';

/**
 * School calendar: holidays + events + PTMs. Events/PTMs are managed by admins only.
 * Optional module: every endpoint answers 403 FEATURE_DISABLED unless the platform
 * team switched `calendar` on for the school (common/tenant-features.ts).
 */
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarService: CalendarService,
  ) {}

  /** Unified, date-sorted feed for the mobile calendar. */
  @Get()
  @Roles(Role.parent, Role.teacher, Role.admin, Role.accounts, Role.super_admin)
  async list(@TenantId() tenantId: string, @Query() query: CalendarQueryDto) {
    await assertFeatureEnabled(this.prisma, tenantId, 'calendar');
    return this.calendarService.list(tenantId, query.from, query.to);
  }

  @Get('events')
  @Roles(Role.admin, Role.super_admin)
  async listEvents(
    @TenantId() tenantId: string,
    @Query() query: EventQueryDto,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'calendar');
    return this.calendarService.listEvents(tenantId, query.from, query.to);
  }

  @Post('events')
  @Roles(Role.admin, Role.super_admin)
  async createEvent(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateEventDto,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'calendar');
    return this.calendarService.createEvent(tenantId, dto, user);
  }

  @Delete('events/:id')
  @HttpCode(204)
  @Roles(Role.admin, Role.super_admin)
  async deleteEvent(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'calendar');
    await this.calendarService.deleteEvent(tenantId, id, user);
  }
}
