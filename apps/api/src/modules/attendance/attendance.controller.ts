import {
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
} from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AttendanceService } from './attendance.service';
import {
  AttendanceReportQueryDto,
  HolidayQueryDto,
  RosterQueryDto,
  SchoolSummaryQueryDto,
  StudentSummaryQueryDto,
} from './dto/attendance-query.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { CreateHolidayDto } from './dto/create-holiday.dto';

/**
 * Daily attendance (docs/SPEC-improvements.md Phase 2). Accounts staff have no
 * access — attendance isn't fee data.
 */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** Classes the caller can mark and whether today is done — the teacher dashboard card. */
  @Get('my-classes')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  myClasses(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.attendanceService.getMyClassesToday(tenantId, user);
  }

  @Get('roster')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  roster(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: RosterQueryDto,
  ) {
    return this.attendanceService.getRoster(
      tenantId,
      query.classId,
      query.date,
      user,
    );
  }

  /** Bulk upsert of a whole class for one date. */
  @Put('class')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  submit(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: SubmitAttendanceDto,
  ) {
    return this.attendanceService.submit(tenantId, dto, user);
  }

  @Get('student/:studentId/summary')
  @Roles(Role.parent, Role.teacher, Role.admin, Role.super_admin)
  studentSummary(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: StudentSummaryQueryDto,
  ) {
    return this.attendanceService.getStudentSummary(
      tenantId,
      studentId,
      query.month,
      user,
    );
  }

  @Get('school-summary')
  @Roles(Role.admin, Role.super_admin)
  schoolSummary(
    @TenantId() tenantId: string,
    @Query() query: SchoolSummaryQueryDto,
  ) {
    return this.attendanceService.getSchoolSummary(tenantId, query.date);
  }

  @Get('report')
  @Roles(Role.admin, Role.super_admin)
  async report(
    @TenantId() tenantId: string,
    @Query() query: AttendanceReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.attendanceService.getReport(tenantId, query);
    if (query.format === 'csv') {
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="attendance-${query.from}-to-${query.to}.csv"`,
      });
      return toCsv(result.data);
    }
    return result;
  }

  @Get('holidays')
  @Roles(Role.parent, Role.teacher, Role.admin, Role.super_admin)
  holidays(@TenantId() tenantId: string, @Query() query: HolidayQueryDto) {
    return this.attendanceService.listHolidays(tenantId, query.from, query.to);
  }

  @Post('holidays')
  @Roles(Role.admin, Role.super_admin)
  createHoliday(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateHolidayDto,
  ) {
    return this.attendanceService.createHoliday(tenantId, dto, user);
  }

  @Delete('holidays/:id')
  @HttpCode(204)
  @Roles(Role.admin, Role.super_admin)
  async deleteHoliday(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.attendanceService.deleteHoliday(tenantId, id, user);
  }
}

const CSV_HEADERS: Record<string, string> = {
  rollNo: 'Roll No',
  studentName: 'Student',
  admissionNo: 'Admission No',
  className: 'Class',
  daysMarked: 'Days Marked',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
  percentage: 'Attendance %',
};

/** Spreadsheet-friendly CSV (opens in Excel); internal ids are left out. */
export function toCsv(rows: Record<string, unknown>[]): string {
  const keys = Object.keys(CSV_HEADERS);
  const escape = (value: unknown) => {
    const str =
      typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
          ? `${value}`
          : value === null || value === undefined
            ? ''
            : JSON.stringify(value);
    // Neutralise spreadsheet formulas, then quote anything with separators.
    const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [
    keys.map((k) => CSV_HEADERS[k]).join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\n');
}
