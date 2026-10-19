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
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  AssignStudentsDto,
  RouteInputDto,
  StudentsQueryDto,
  UnassignStudentsDto,
} from './dto/school-bus.dto';
import { SchoolBusService } from './school-bus.service';

const STAFF = [Role.admin, Role.accounts, Role.super_admin] as const;

/** School bus routes (flag `transport`). */
@Controller('transport')
@UseGuards(FeatureGuard('transport'))
export class SchoolBusController {
  constructor(private readonly transport: SchoolBusService) {}

  @Get('routes')
  @Roles(...STAFF)
  routes(@TenantId() tenantId: string) {
    return this.transport.routes(tenantId);
  }

  /** Ground staff to pick a driver or attendant from. */
  @Get('drivers')
  @Roles(...STAFF)
  drivers(@TenantId() tenantId: string) {
    return this.transport.drivers(tenantId);
  }

  @Post('routes')
  @Roles(...STAFF)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: RouteInputDto,
  ) {
    return this.transport.createRoute(tenantId, user.id, dto);
  }

  @Put('routes/:id')
  @Roles(...STAFF)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RouteInputDto,
  ) {
    return this.transport.updateRoute(tenantId, user.id, id, dto);
  }

  @Delete('routes/:id')
  @Roles(...STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.transport.deleteRoute(tenantId, user.id, id);
  }

  @Get('routes/:id/students')
  @Roles(...STAFF)
  routeStudents(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transport.routeStudents(tenantId, id);
  }

  /** A class's students and the route each is on, for adding riders. */
  @Get('students')
  @Roles(...STAFF)
  classStudents(
    @TenantId() tenantId: string,
    @Query() query: StudentsQueryDto,
  ) {
    return this.transport.classStudents(tenantId, query.classId);
  }

  @Post('assign')
  @Roles(...STAFF)
  assign(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: AssignStudentsDto,
  ) {
    return this.transport.assign(tenantId, user.id, dto);
  }

  @Post('unassign')
  @Roles(...STAFF)
  unassign(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: UnassignStudentsDto,
  ) {
    return this.transport.unassign(tenantId, user.id, dto);
  }

  /** The parent's own child: route, stop and times, driver and attendant. */
  @Get('child/:studentId')
  @Roles(Role.parent)
  child(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.transport.child(tenantId, user.id, studentId);
  }
}
