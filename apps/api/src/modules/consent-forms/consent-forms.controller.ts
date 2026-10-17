import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { displayDate } from '../attendance/attendance-dates';
import { ConsentFormsService } from './consent-forms.service';
import {
  ConsentFormQueryDto,
  CreateConsentFormDto,
  RespondConsentDto,
} from './dto/consent-forms.dto';

const STATUS_LABEL = {
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  PENDING: 'Not answered',
};

/** Spreadsheet-safe CSV cell: formulas neutralised, separators quoted. */
const cell = (value: string | null) => {
  const str = value ?? '';
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * Parent consent forms for events. Part of the school calendar, so every route
 * needs the `calendar` flag. Admins send and track them; parents sign for their
 * own children only (resolved from student_parents, never from the request).
 */
@Controller('consent-forms')
@UseGuards(FeatureGuard('calendar'))
export class ConsentFormsController {
  constructor(private readonly consent: ConsentFormsService) {}

  @Get()
  @Roles(Role.admin, Role.super_admin)
  list(@TenantId() tenantId: string, @Query() query: ConsentFormQueryDto) {
    return this.consent.list(tenantId, query.eventId);
  }

  @Post()
  @Roles(Role.admin, Role.super_admin)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateConsentFormDto,
  ) {
    return this.consent.create(tenantId, dto, user);
  }

  /** The signed-in parent's forms, one item per child. */
  @Get('mine')
  @Roles(Role.parent)
  mine(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.consent.mine(tenantId, user.id);
  }

  @Get(':id')
  @Roles(Role.admin, Role.super_admin)
  async detail(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const form = await this.consent.detail(tenantId, id);
    if (format !== 'csv') return form;
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="consent-${form.event.startDate}.csv"`,
    });
    const header = [
      'Class',
      'Roll no',
      'Student',
      'Admission no',
      'Answer',
      'Signed by',
      'Parent account',
      'Parent phone',
      'Signed on',
      'Note',
    ];
    const lines = form.rows.map((r) =>
      [
        r.className,
        r.rollNo,
        r.studentName,
        r.admissionNo,
        STATUS_LABEL[r.status],
        r.signedName,
        r.parentName,
        r.parentPhone,
        r.signedOn ? displayDate(r.signedOn) : null,
        r.note,
      ]
        .map(cell)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  @Post(':id/remind')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  remind(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.consent.remind(tenantId, id, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.admin, Role.super_admin)
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.consent.remove(tenantId, id, user);
  }

  @Post(':id/respond')
  @HttpCode(200)
  @Roles(Role.parent)
  respond(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondConsentDto,
  ) {
    return this.consent.respond(tenantId, user.id, id, dto);
  }
}
