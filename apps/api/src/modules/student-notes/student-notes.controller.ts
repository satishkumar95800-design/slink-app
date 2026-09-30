import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { StudentNotesService } from './student-notes.service';
import { CreateStudentNoteDto } from './dto/create-student-note.dto';
import { StudentNoteQueryDto } from './dto/student-note-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('student-notes')
export class StudentNotesController {
  constructor(private readonly studentNotesService: StudentNotesService) {}

  @Post()
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateStudentNoteDto,
  ) {
    return this.studentNotesService.create(tenantId, dto, user);
  }

  @Get()
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  findForStudent(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: StudentNoteQueryDto,
  ) {
    return this.studentNotesService.findForStudent(tenantId, query, user);
  }
}
