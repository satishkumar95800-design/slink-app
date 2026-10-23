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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { BusTrackingService } from './bus-tracking.service';
import { PositionDto, StartTripDto } from './dto/bus-tracking.dto';

const STAFF = [Role.admin, Role.accounts, Role.super_admin] as const;

/** Live bus tracking (flags `transport` + `busTracking`, checked in the service). */
@Controller('transport')
@UseGuards(FeatureGuard('transport'))
export class BusTrackingController {
  constructor(private readonly tracking: BusTrackingService) {}

  @Get('driver-access')
  @Roles(...STAFF)
  driverAccess(@TenantId() tenantId: string) {
    return this.tracking.driverAccess(tenantId);
  }

  @Post('driver-access/:payeeId')
  @Roles(...STAFF)
  grant(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('payeeId', ParseUUIDPipe) payeeId: string,
  ) {
    return this.tracking.grantAccess(tenantId, user.id, payeeId);
  }

  @Delete('driver-access/:payeeId')
  @Roles(...STAFF)
  revoke(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('payeeId', ParseUUIDPipe) payeeId: string,
  ) {
    return this.tracking.revokeAccess(tenantId, user.id, payeeId);
  }

  @Get('live')
  @Roles(...STAFF)
  live(@TenantId() tenantId: string) {
    return this.tracking.live(tenantId);
  }

  @Get('driver/me')
  @Roles(Role.driver)
  driverHome(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.tracking.driverHome(tenantId, user.id);
  }

  @Post('driver/trips')
  @Roles(Role.driver)
  start(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: StartTripDto,
  ) {
    return this.tracking.startTrip(tenantId, user.id, dto);
  }

  @Post('driver/trips/:id/position')
  @Roles(Role.driver)
  @HttpCode(HttpStatus.OK)
  position(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PositionDto,
  ) {
    return this.tracking.position(tenantId, user.id, id, dto);
  }

  @Post('driver/trips/:id/end')
  @Roles(Role.driver)
  @HttpCode(HttpStatus.OK)
  end(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tracking.endTrip(tenantId, user.id, id);
  }

  /** The parent's own child's bus while a trip runs. */
  @Get('child/:studentId/live')
  @Roles(Role.parent)
  childLive(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.tracking.childLive(tenantId, user.id, studentId);
  }
}
