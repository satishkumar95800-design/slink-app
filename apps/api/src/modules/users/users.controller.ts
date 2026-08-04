import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSelfDto } from './dto/update-self.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Self endpoints — declared first to avoid shadowing by :id ────────────────

  @Get('me')
  getMe(@CurrentUser() user: ActiveUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: ActiveUser,
    @TenantId() tenantId: string,
    @Body() dto: UpdateSelfDto,
  ) {
    return this.usersService.updateMe(user.id, tenantId, dto);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: ActiveUser, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user.id, dto);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────────

  @Roles(Role.admin, Role.accounts)
  @Get()
  findAll(@TenantId() tenantId: string, @Query() query: UserQueryDto) {
    return this.usersService.findAll(tenantId, query);
  }

  @Roles(Role.admin)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
    return this.usersService.create(tenantId, dto);
  }

  @Roles(Role.admin, Role.accounts)
  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.findById(tenantId, id);
  }

  @Roles(Role.admin)
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(tenantId, id, dto);
  }

  @Roles(Role.admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.usersService.remove(tenantId, id);
  }

  @Roles(Role.admin)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(tenantId, id, dto);
  }
}
