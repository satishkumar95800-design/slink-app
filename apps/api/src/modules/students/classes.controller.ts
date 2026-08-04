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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /** Admin and teachers can list classes (teachers see only their own). */
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.super_admin)
  @Get()
  findAll(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.classesService.findAll(tenantId, user);
  }

  @Roles(Role.admin, Role.accounts, Role.teacher, Role.super_admin)
  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.classesService.findOne(tenantId, id, user);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateClassDto) {
    return this.classesService.create(tenantId, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(tenantId, id, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.classesService.remove(tenantId, id);
  }
}
