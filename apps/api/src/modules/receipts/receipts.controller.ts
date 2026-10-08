import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ReceiptsService } from './receipts.service';
import { RecentReceiptsQueryDto } from './dto/recent-receipts-query.dto';

/** Single-receipt fetch for the printable receipt view. Listing lives under /insights/paid-history. */
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * Addendum 4 / A9 — unauthenticated view behind a signed, time-limited
   * token (the SMS link/push-tap target). No X-Tenant-ID header is available
   * here, so this route is excluded from TenantMiddleware in app.module.ts;
   * the verified token itself carries the tenantId.
   */
  @Public()
  @Get('public/:token')
  findByToken(@Param('token') token: string) {
    return this.receiptsService.findByToken(token);
  }

  /** Same signed token as the public receipt page, but returns the PDF — opened from the app in the phone's browser. */
  @Public()
  @Get('public/:token/pdf')
  async findPdfByToken(@Param('token') token: string, @Res({ passthrough: true }) res: Response) {
    const receipt = await this.receiptsService.findByToken(token);
    const { filename, pdf } = await this.receiptsService.renderPdf(receipt);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` });
    return new StreamableFile(pdf);
  }

  /** Receipt as a PDF file (school, student, amount, method, discount, date, receipt no.). Same access rules as viewing it. */
  @Get(':id/pdf')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  async getPdf(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { filename, pdf } = await this.receiptsService.getPdf(tenantId, id, user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
    return new StreamableFile(pdf);
  }

  /** Addendum 4 / A9 — mobile in-app "Download" action for a receipt the caller already has access to. */
  @Get(':id/download-link')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  getDownloadLink(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.getDownloadLink(tenantId, id, user);
  }

  /** Receipts for one student fee — e.g. mobile's Fees list "View Receipt" action. */
  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findForStudentFee(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query('studentFeeId', ParseUUIDPipe) studentFeeId: string,
  ) {
    return this.receiptsService.findForStudentFee(tenantId, studentFeeId, user);
  }

  /** Admin dashboard "Recent Payments" widget — must stay declared before the `:id` route below, or Nest/Express would route `/receipts/recent` into `findOne`'s ParseUUIDPipe and 400. */
  @Get('recent')
  @Roles(Role.admin, Role.accounts, Role.super_admin)
  getRecent(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: RecentReceiptsQueryDto,
  ) {
    return this.receiptsService.getRecent(tenantId, user, query.limit ?? 5);
  }

  @Get(':id')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.findOne(tenantId, id, user);
  }
}
