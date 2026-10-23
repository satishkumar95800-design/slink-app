import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  CompleteTopicDto,
  CopyPlanDto,
  ImportQueryDto,
  OverviewQueryDto,
  SavePlanDto,
} from './dto/syllabus.dto';
import { buildSyllabusTemplate } from './syllabus-import';
import { SyllabusService } from './syllabus.service';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const upload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES },
});

/**
 * Syllabus progress (flag `syllabus`). Admins plan topics and target dates;
 * subject teachers mark them covered; parents read their own child's class.
 * Fixed paths are declared before ":classId/:subjectId".
 */
@Controller('syllabus')
@UseGuards(FeatureGuard('syllabus'))
export class SyllabusController {
  constructor(private readonly syllabus: SyllabusService) {}

  /** Every class and subject (admin) or the teacher's own, with on time / late. */
  @Get('overview')
  @Roles(Role.admin, Role.super_admin, Role.teacher)
  overview(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: OverviewQueryDto,
  ) {
    return this.syllabus.overview(tenantId, user, query.classId);
  }

  /** The signed-in teacher's own classes and subjects (mobile). */
  @Get('mine')
  @Roles(Role.teacher)
  mine(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.syllabus.overview(tenantId, user);
  }

  @Get('child/:studentId')
  @Roles(Role.parent)
  child(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.syllabus.child(tenantId, user.id, studentId);
  }

  @Get('import/template')
  @Roles(Role.admin, Role.super_admin)
  async template(@Res({ passthrough: true }) res: Response) {
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="syllabus-template.xlsx"',
    });
    // A file, not JSON (a returned Buffer would be serialised).
    return new StreamableFile(await buildSyllabusTemplate());
  }

  @Post('import/validate')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  @UseInterceptors(upload)
  validate(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.syllabus.validateImport(tenantId, file.buffer);
  }

  @Post('import/commit')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  @UseInterceptors(upload)
  commit(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ImportQueryDto,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.syllabus.commitImport(
      tenantId,
      user,
      file.buffer,
      !!query.replace,
    );
  }

  @Post('topics/:id/complete')
  @HttpCode(200)
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  complete(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTopicDto,
  ) {
    return this.syllabus.complete(tenantId, user, id, dto.date);
  }

  @Delete('topics/:id/complete')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  undo(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.syllabus.undo(tenantId, user, id);
  }

  @Get(':classId/:subjectId')
  @Roles(Role.admin, Role.super_admin, Role.teacher)
  plan(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return this.syllabus.plan(tenantId, user, classId, subjectId);
  }

  @Put(':classId/:subjectId')
  @Roles(Role.admin, Role.super_admin)
  save(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: SavePlanDto,
  ) {
    return this.syllabus.savePlan(tenantId, user, classId, subjectId, dto);
  }

  @Post(':classId/:subjectId/copy')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  copy(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Body() dto: CopyPlanDto,
  ) {
    return this.syllabus.copyPlan(tenantId, user, classId, subjectId, dto);
  }
}
