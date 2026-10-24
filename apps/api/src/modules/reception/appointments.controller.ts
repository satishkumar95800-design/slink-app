import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AppointmentsService } from './appointments.service';
import {
  AppointmentDto,
  AppointmentRangeDto,
  UpdateAppointmentDto,
} from './dto/appointments.dto';

/** Front desk appointments (flag `admissions`, with the rest of the desk). */
@Controller('reception/appointments')
@Roles(Role.receptionist, Role.admin, Role.accounts, Role.super_admin)
@UseGuards(FeatureGuard('admissions'))
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query() q: AppointmentRangeDto) {
    return this.appointments.list(tenantId, q);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: AppointmentDto,
  ) {
    return this.appointments.create(tenantId, user.id, dto);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointments.update(tenantId, user.id, id, dto);
  }
}
