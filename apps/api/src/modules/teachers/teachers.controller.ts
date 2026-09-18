import {
  Controller,
  Get,
  Post,
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
import { TeachersService } from './teachers.service';
import { CreateTeacherSubjectDto } from './dto/create-teacher-subject.dto';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.super_admin)
  findAll(@TenantId() tenantId: string) {
    return this.teachersService.findAll(tenantId);
  }

  @Post(':id/subjects')
  @Roles(Role.admin, Role.super_admin)
  addSubject(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeacherSubjectDto,
  ) {
    return this.teachersService.addSubject(tenantId, id, dto);
  }

  @Delete(':id/subjects/:assignmentId')
  @Roles(Role.admin, Role.super_admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeSubject(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    await this.teachersService.removeSubject(tenantId, id, assignmentId);
  }
}
