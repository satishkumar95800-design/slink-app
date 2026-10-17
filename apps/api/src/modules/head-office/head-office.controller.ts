import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  GroupNameDto,
  GroupSchoolsDto,
  HeadOfficeUserDto,
  PasswordDto,
} from './dto/groups.dto';
import { GroupsService } from './groups.service';
import { HeadOfficeService } from './head-office.service';

/**
 * Head office (franchise) view: read-only, GET only. The group is resolved
 * from the signed-in user. Excluded from TenantMiddleware.
 */
@Controller('head-office')
@Roles(Role.head_office)
export class HeadOfficeController {
  constructor(private readonly headOffice: HeadOfficeService) {}

  @Get('overview')
  overview(@CurrentUser() user: ActiveUser) {
    return this.headOffice.overview(user);
  }

  @Get('branches/:tenantId')
  branch(
    @CurrentUser() user: ActiveUser,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.headOffice.branch(user, tenantId);
  }
}

/** Groups, their schools and head office logins (platform console). */
@Controller('platform/groups')
@Roles(Role.super_admin)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list() {
    return this.groups.list();
  }

  @Post()
  create(@Body() dto: GroupNameDto, @CurrentUser() user: ActiveUser) {
    return this.groups.create(dto, user);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupNameDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.rename(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.remove(id, user);
  }

  @Put(':id/schools')
  setSchools(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupSchoolsDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.setSchools(id, dto, user);
  }

  @Post(':id/users')
  createUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HeadOfficeUserDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.groups.createUser(id, dto, user);
  }

  @Post(':id/users/:userId/password')
  @HttpCode(204)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PasswordDto,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.resetPassword(id, userId, dto.password, user);
  }

  @Delete(':id/users/:userId')
  @HttpCode(204)
  async removeUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.groups.removeUser(id, userId, user);
  }
}
