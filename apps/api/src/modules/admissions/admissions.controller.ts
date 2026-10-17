import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  CreateEnquiryDto,
  EnquiryQueryDto,
  MoveStageDto,
  NoteDto,
  UpdateEnquiryDto,
} from './dto/admissions.dto';
import { AdmissionsService } from './admissions.service';

/** Admissions pipeline (flag `admissions`): the school office. */
@Controller('admissions')
@Roles(Role.admin, Role.accounts, Role.super_admin)
@UseGuards(FeatureGuard('admissions'))
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return this.admissions.summary(tenantId);
  }

  @Get()
  list(@TenantId() tenantId: string, @Query() q: EnquiryQueryDto) {
    return this.admissions.list(tenantId, q);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body() dto: CreateEnquiryDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.admissions.create(tenantId, dto, user);
  }

  @Get(':id')
  detail(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.admissions.detail(tenantId, id);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.admissions.update(tenantId, id, dto, user);
  }

  @Post(':id/stage')
  @HttpCode(200)
  move(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.admissions.moveStage(tenantId, id, dto, user);
  }

  @Post(':id/notes')
  @HttpCode(200)
  note(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.admissions.addNote(tenantId, id, dto.note, user);
  }
}
