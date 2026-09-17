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
import { TenantsService } from './tenants.service';
import { UsersService } from '../users/users.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { PurgeTenantDto } from './dto/purge-tenant.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';

/**
 * Platform-level tenant management for super_admin.
 * These routes are excluded from TenantMiddleware — no X-Tenant-ID required.
 */
@Controller('tenants')
@Roles(Role.super_admin)
export class TenantsAdminController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(@Query() query: TenantQueryDto) {
    return this.tenantsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.deactivate(id);
  }

  /** Irreversible — permanently deletes the tenant and every row scoped to it. */
  @Delete(':id/purge')
  @HttpCode(HttpStatus.OK)
  purge(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PurgeTenantDto) {
    return this.tenantsService.purge(id, dto.confirmSlug);
  }

  /** Bootstraps a staff or developer-support account directly on a tenant — the only
   * way to get a brand-new tenant its first admin without going through bulk import. */
  @Post(':id/users')
  createUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTenantUserDto,
  ) {
    return this.usersService.create(id, dto);
  }
}
