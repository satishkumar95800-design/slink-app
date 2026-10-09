import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { TimetableService } from './timetable.service';
import { TimetableQueryDto } from './dto/timetable-query.dto';
import { UpsertTimetableSlotDto } from './dto/upsert-timetable-slot.dto';
import { ReplacePeriodTimingsDto } from './dto/period-timings.dto';

/** Addendum 4 / A10 — admin-managed weekly timetable, read by the teacher dashboard. */
@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  /** Teacher's own weekly routine — must come before ':classId'-shaped routes below. */
  /** The school's bell schedule (start/end per period number). */
  @Get('period-timings')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.super_admin)
  periodTimings(@TenantId() tenantId: string) {
    return this.timetableService.listPeriodTimings(tenantId);
  }

  @Put('period-timings')
  @Roles(Role.admin, Role.super_admin)
  replacePeriodTimings(@TenantId() tenantId: string, @Body() dto: ReplacePeriodTimingsDto) {
    return this.timetableService.replacePeriodTimings(tenantId, dto.periods);
  }

  @Get('mine')
  @Roles(Role.teacher)
  findMine(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.timetableService.findMine(tenantId, user.id);
  }

  /** Admin grid editor — all slots for one class. */
  @Get()
  @Roles(Role.admin, Role.accounts, Role.super_admin)
  findForClass(@TenantId() tenantId: string, @Query() query: TimetableQueryDto) {
    return this.timetableService.findForClass(tenantId, query.classId);
  }

  @Post()
  @Roles(Role.admin, Role.super_admin)
  upsert(@TenantId() tenantId: string, @Body() dto: UpsertTimetableSlotDto) {
    return this.timetableService.upsert(tenantId, dto);
  }

  @Delete(':id')
  @Roles(Role.admin, Role.super_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.timetableService.remove(tenantId, id);
  }
}
