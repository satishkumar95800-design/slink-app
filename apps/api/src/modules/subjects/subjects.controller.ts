import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.super_admin)
  findAll(@TenantId() tenantId: string) {
    return this.subjectsService.findAll(tenantId);
  }

  @Post()
  @Roles(Role.admin, Role.super_admin)
  create(@TenantId() tenantId: string, @Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.super_admin)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin, Role.super_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.subjectsService.remove(tenantId, id);
  }
}
