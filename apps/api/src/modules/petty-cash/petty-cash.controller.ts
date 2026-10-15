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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express, Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  AdvanceQueryDto,
  CategoryQueryDto,
  CreateCategoryDto,
  CreateEntryDto,
  CreatePayeeDto,
  EntryQueryDto,
  PayeeQueryDto,
  ReasonDto,
  StatementQueryDto,
  UpdateCategoryDto,
  UpdatePayeeDto,
  UpdateSettingsDto,
} from './dto/petty-cash.dto';
import { PettyCashFeatureGuard } from './petty-cash-feature.guard';
import { PettyCashForecastService } from './petty-cash-forecast.service';
import { PettyCashService } from './petty-cash.service';

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/**
 * Petty cash: admin console only. Class-level @Roles keeps parents and teachers
 * out of every route; approval and settings narrow it to admin further down.
 * super_admin is included as an admin equivalent, matching the other finance
 * controllers (insights, receipts, transfer certificates).
 * The feature guard answers FEATURE_DISABLED unless `pettyCash` is on.
 */
@Controller('petty-cash')
@Roles(Role.admin, Role.accounts, Role.super_admin)
@UseGuards(PettyCashFeatureGuard)
export class PettyCashController {
  constructor(
    private readonly petty: PettyCashService,
    private readonly forecast: PettyCashForecastService,
  ) {}

  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return this.petty.summary(tenantId);
  }

  @Get('entries')
  list(@TenantId() tenantId: string, @Query() query: EntryQueryDto) {
    return this.petty.listEntries(tenantId, query);
  }

  @Get('export')
  async export(
    @TenantId() tenantId: string,
    @Query() query: EntryQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.petty.exportCsv(tenantId, query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="petty-cash-ledger.csv"',
    });
    return csv;
  }

  @Post('entries')
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateEntryDto,
  ) {
    return this.petty.createEntry(tenantId, user, dto);
  }

  @Post('entries/:id/approve')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petty.approve(tenantId, id, user);
  }

  @Post('entries/:id/reject')
  @HttpCode(200)
  @Roles(Role.admin, Role.super_admin)
  reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.petty.reject(tenantId, id, dto.reason, user);
  }

  @Post('entries/:id/void')
  @HttpCode(200)
  void(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.petty.voidEntry(tenantId, id, dto.reason, user);
  }

  @Get('entries/:id/receipt-url')
  receiptUrl(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petty.receiptUrl(tenantId, id);
  }

  @Post('receipts')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_RECEIPT_BYTES },
    }),
  )
  uploadReceipt(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.petty.uploadReceipt(tenantId, file, user);
  }

  @Get('advances')
  advances(@TenantId() tenantId: string, @Query() query: AdvanceQueryDto) {
    return this.petty.listAdvances(tenantId, query);
  }

  @Get('statement')
  statement(@TenantId() tenantId: string, @Query() query: StatementQueryDto) {
    return this.petty.statement(tenantId, query);
  }

  @Get('staff')
  staff(@TenantId() tenantId: string) {
    return this.petty.listStaff(tenantId);
  }

  @Get('categories')
  categories(@TenantId() tenantId: string, @Query() query: CategoryQueryDto) {
    return this.petty.listCategories(tenantId, query.includeInactive);
  }

  @Post('categories')
  createCategory(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.petty.createCategory(tenantId, dto, user);
  }

  @Patch('categories/:id')
  updateCategory(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.petty.updateCategory(tenantId, id, dto, user);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  async deleteCategory(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.petty.deleteCategory(tenantId, id, user);
  }

  @Get('payees')
  payees(@TenantId() tenantId: string, @Query() query: PayeeQueryDto) {
    return this.petty.listPayees(tenantId, query);
  }

  @Post('payees')
  createPayee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreatePayeeDto,
  ) {
    return this.petty.createPayee(tenantId, dto, user);
  }

  @Patch('payees/:id')
  updatePayee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayeeDto,
  ) {
    return this.petty.updatePayee(tenantId, id, dto, user);
  }

  @Get('settings')
  settings(@TenantId() tenantId: string) {
    return this.petty.getSettingsView(tenantId);
  }

  @Put('settings')
  @Roles(Role.admin, Role.super_admin)
  updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.petty.updateSettings(tenantId, dto, user);
  }

  @Get('forecast')
  forecastView(@TenantId() tenantId: string) {
    return this.forecast.forecast(tenantId);
  }

  /** Plain-language advice; the model only rephrases rules-computed findings (and only with aiInsights on). */
  @Post('forecast/advice')
  @HttpCode(200)
  advice(@TenantId() tenantId: string) {
    return this.forecast.advice(tenantId);
  }
}
