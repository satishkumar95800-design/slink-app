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
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { BulkCreateStudentsDto } from './dto/bulk-create-students.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  /**
   * List students — response is role-scoped:
   *   admin/accounts → all students in tenant
   *   teacher → students in their assigned class(es)
   *   parent → their own linked children only
   */
  @Get()
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: StudentQueryDto,
  ) {
    return this.studentsService.findAll(tenantId, user, query);
  }

  /** Convenience endpoint for parents to get their own children without query params. */
  @Roles(Role.parent)
  @Get('me')
  findMyChildren(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.studentsService.findMyChildren(tenantId, user.id);
  }

  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.studentsService.findOne(tenantId, id, user);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateStudentDto) {
    return this.studentsService.create(tenantId, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Post('bulk')
  bulkCreate(@TenantId() tenantId: string, @Body() dto: BulkCreateStudentsDto) {
    return this.studentsService.bulkCreate(tenantId, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(tenantId, id, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.studentsService.remove(tenantId, id);
  }

  // ─── Parent linkage (admin only — changing this changes who can see a child) ──

  @Roles(Role.admin, Role.super_admin)
  @Post(':id/parents')
  linkParent(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkParentDto,
  ) {
    return this.studentsService.linkParent(tenantId, id, dto);
  }

  @Roles(Role.admin, Role.super_admin)
  @Delete(':id/parents/:parentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkParent(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ) {
    await this.studentsService.unlinkParent(tenantId, studentId, parentId);
  }
}
