import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  AdjustmentDto,
  BalanceQueryDto,
  CreateEmployeeDto,
  CreateLeaveForEmployeeDto,
  CreateLeaveTypeDto,
  CreateStructureDto,
  DailyQueryDto,
  EmployeeQueryDto,
  ExitEmployeeDto,
  FromUserDto,
  GeneratePayRunDto,
  ImportQueryDto,
  LeaveDecisionDto,
  LeaveRequestQueryDto,
  LeaveTypeQueryDto,
  MarkPaidDto,
  MonthQueryDto,
  PayRunQueryDto,
  ReasonDto,
  RevealDto,
  SaveDailyDto,
  StructureQueryDto,
  UpdateEmployeeDto,
  UpdateHrSettingsDto,
  UpdateLeaveTypeDto,
  UploadDocumentDto,
} from './dto/hrms.dto';
import { EmployeeImportService } from './employee-import.service';
import { EmployeesService } from './employees.service';
import { HrSettingsService } from './hr-settings.service';
import { HrmsFeatureGuard } from './hrms-feature.guard';
import { LeaveService } from './leave.service';
import { PayrollService } from './payroll.service';
import { StaffAttendanceService } from './staff-attendance.service';
import { hrmsStrings as t } from './hrms.strings';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const upload = (maxBytes: number) =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
  });

/**
 * HR & payroll console API. admin, accounts and super_admin (the usual finance
 * equivalent of admin) manage everything; approving and locking pay runs and
 * changing statutory settings narrow to admin below. Teachers and other staff
 * only get /hrms/me (HrmsMeController); parents and developers get nothing.
 * Every route answers 403 FEATURE_DISABLED unless `hrms` is on for the school.
 * Static routes are declared before `:id` ones.
 */
@Controller('hrms')
@Roles(Role.admin, Role.accounts, Role.super_admin)
@UseGuards(HrmsFeatureGuard)
export class HrmsController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly importer: EmployeeImportService,
    private readonly settings: HrSettingsService,
    private readonly attendance: StaffAttendanceService,
    private readonly leave: LeaveService,
    private readonly payroll: PayrollService,
  ) {}

  // ── employees ─────────────────────────────────────────────────────────────

  @Get('employees')
  listEmployees(@TenantId() tenantId: string, @Query() q: EmployeeQueryDto) {
    return this.employees.list(tenantId, q);
  }

  @Get('employees/departments')
  departments(@TenantId() tenantId: string) {
    return this.employees.departments(tenantId);
  }

  @Get('employees/staff-users')
  staffUsers(@TenantId() tenantId: string) {
    return this.employees.unlinkedStaff(tenantId);
  }

  @Get('employees/import/template')
  async importTemplate(@Res({ passthrough: true }) res: Response) {
    const buf = await this.importer.template();
    res.set({
      'Content-Type': XLSX_MIME,
      'Content-Disposition':
        'attachment; filename="employee-import-template.xlsx"',
    });
    return new StreamableFile(buf);
  }

  /** ?dryRun=true validates only; otherwise imports every row or none. */
  @Post('employees/import')
  @HttpCode(200)
  @UseInterceptors(upload(10 * 1024 * 1024))
  importEmployees(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
    @Query() q: ImportQueryDto,
  ) {
    if (!file) throw new BadRequestException(t.importNoFile);
    return this.importer.run(tenantId, user, file, q.dryRun ?? false);
  }

  @Post('employees/from-user')
  createFromUser(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: FromUserDto,
  ) {
    return this.employees.createFromUser(tenantId, user, dto);
  }

  @Post('employees')
  createEmployee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employees.create(tenantId, user, dto);
  }

  @Get('employees/:id')
  getEmployee(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.get(tenantId, id);
  }

  @Patch('employees/:id')
  updateEmployee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(tenantId, user, id, dto);
  }

  @Post('employees/:id/exit')
  @HttpCode(200)
  exitEmployee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExitEmployeeDto,
  ) {
    return this.employees.exit(tenantId, user, id, dto);
  }

  @Post('employees/:id/reactivate')
  @HttpCode(200)
  reactivateEmployee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.reactivate(tenantId, user, id);
  }

  /** Explicit, audit-logged reveal of encrypted identifiers and bank details. */
  @Post('employees/:id/reveal')
  @HttpCode(200)
  reveal(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevealDto,
  ) {
    return this.employees.reveal(tenantId, user, id, dto.fields);
  }

  @Get('employees/:id/documents')
  listDocuments(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employees.listDocuments(tenantId, id);
  }

  @Post('employees/:id/documents')
  @UseInterceptors(upload(10 * 1024 * 1024))
  uploadDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.employees.uploadDocument(tenantId, user, id, file, dto.label);
  }

  @Get('employees/:id/documents/:docId/url')
  documentUrl(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.employees.documentUrl(tenantId, user, id, docId);
  }

  @Delete('employees/:id/documents/:docId')
  @HttpCode(204)
  async deleteDocument(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    await this.employees.deleteDocument(tenantId, user, id, docId);
  }

  // ── settings ──────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings(@TenantId() tenantId: string) {
    return this.settings.getView(tenantId);
  }

  /** Statutory rates and working-days rules change money: admin only. */
  @Put('settings')
  @Roles(Role.admin, Role.super_admin)
  updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: UpdateHrSettingsDto,
  ) {
    return this.settings.update(tenantId, dto, user);
  }

  // ── staff attendance ──────────────────────────────────────────────────────

  @Get('attendance/daily')
  daily(@TenantId() tenantId: string, @Query() q: DailyQueryDto) {
    return this.attendance.daily(tenantId, q.date);
  }

  @Put('attendance/daily')
  saveDaily(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: SaveDailyDto,
  ) {
    return this.attendance.saveDaily(tenantId, user, dto);
  }

  @Get('attendance/monthly')
  monthly(@TenantId() tenantId: string, @Query() q: MonthQueryDto) {
    return this.attendance.monthly(tenantId, q.month, q.employeeId);
  }

  // ── leave ─────────────────────────────────────────────────────────────────

  @Get('leave/types')
  leaveTypes(@TenantId() tenantId: string, @Query() q: LeaveTypeQueryDto) {
    return this.leave.listTypes(tenantId, q.includeInactive ?? false);
  }

  @Post('leave/types')
  createLeaveType(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return this.leave.createType(tenantId, user, dto);
  }

  @Patch('leave/types/:id')
  updateLeaveType(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leave.updateType(tenantId, user, id, dto);
  }

  @Get('leave/requests')
  leaveRequests(
    @TenantId() tenantId: string,
    @Query() q: LeaveRequestQueryDto,
  ) {
    return this.leave.listRequests(tenantId, q);
  }

  /** On behalf of an employee (for example ground staff with no login). Still starts as PENDING. */
  @Post('leave/requests')
  createLeave(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateLeaveForEmployeeDto,
  ) {
    return this.leave.apply(tenantId, user.id, dto.employeeId, dto);
  }

  @Post('leave/requests/:id/approve')
  @HttpCode(200)
  approveLeave(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.approve(tenantId, user, id, dto.note);
  }

  @Post('leave/requests/:id/reject')
  @HttpCode(200)
  rejectLeave(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveDecisionDto,
  ) {
    return this.leave.reject(tenantId, user, id, dto.note);
  }

  @Post('leave/requests/:id/cancel')
  @HttpCode(200)
  cancelLeave(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leave.cancel(tenantId, user, id, null);
  }

  @Get('leave/balances')
  balances(@TenantId() tenantId: string, @Query() q: BalanceQueryDto) {
    return this.leave.balancesForAll(tenantId, q.date, q.employeeId);
  }

  // ── payroll: structures ───────────────────────────────────────────────────

  @Get('payroll/structures')
  structures(@TenantId() tenantId: string, @Query() q: StructureQueryDto) {
    return this.payroll.listStructures(tenantId, q.employeeId);
  }

  @Get('payroll/structures/coverage')
  coverage(@TenantId() tenantId: string) {
    return this.payroll.coverage(tenantId);
  }

  @Post('payroll/structures')
  createStructure(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateStructureDto,
  ) {
    return this.payroll.createStructure(tenantId, user, dto);
  }

  // ── payroll: pay runs ─────────────────────────────────────────────────────

  @Get('payroll/runs')
  runs(@TenantId() tenantId: string, @Query() q: PayRunQueryDto) {
    return this.payroll.list(tenantId, q);
  }

  @Post('payroll/runs')
  generate(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: GeneratePayRunDto,
  ) {
    return this.payroll.generate(tenantId, user, dto);
  }

  @Get('payroll/runs/:id')
  run(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.payroll.get(tenantId, id);
  }

  @Post('payroll/runs/:id/regenerate')
  @HttpCode(200)
  regenerate(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.regenerate(tenantId, user, id);
  }

  @Post('payroll/runs/:id/submit')
  @HttpCode(200)
  submit(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.submit(tenantId, user, id);
  }

  @Post('payroll/runs/:id/reopen')
  @HttpCode(200)
  reopen(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.reopen(tenantId, user, id);
  }

  @Post('payroll/runs/:id/approve')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.approve(tenantId, user, id);
  }

  @Post('payroll/runs/:id/lock')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  lock(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payroll.lock(tenantId, user, id);
  }

  @Post('payroll/runs/:id/cancel')
  @HttpCode(200)
  cancelRun(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.payroll.cancel(tenantId, user, id, dto.reason);
  }

  @Post('payroll/runs/:id/mark-paid')
  @HttpCode(200)
  markPaid(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.payroll.markPaid(tenantId, user, id, dto.reference);
  }

  @Get('payroll/runs/:id/lines/:lineId')
  line(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.payroll.getLine(tenantId, id, lineId);
  }

  @Post('payroll/runs/:id/lines/:lineId/adjustments')
  addAdjustment(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: AdjustmentDto,
  ) {
    return this.payroll.addAdjustment(tenantId, user, id, lineId, dto);
  }

  @Delete('payroll/runs/:id/lines/:lineId/adjustments/:itemId')
  removeAdjustment(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.payroll.removeAdjustment(tenantId, user, id, lineId, itemId);
  }

  @Get('payroll/runs/:id/lines/:lineId/payslip')
  async payslip(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdf, filename } = await this.payroll.payslipPdf(
      tenantId,
      id,
      lineId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(pdf);
  }

  @Get('payroll/runs/:id/bank-csv')
  async bankCsv(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { csv, excluded, filename } = await this.payroll.bankCsv(
      tenantId,
      user,
      id,
    );
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Excluded-Count': String(excluded),
    });
    return csv;
  }

  @Get('payroll/runs/:id/register-csv')
  async registerCsv(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { csv, filename } = await this.payroll.registerCsv(tenantId, id);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return csv;
  }
}
