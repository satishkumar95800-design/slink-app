import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { PaymentClaimsService } from './payment-claims.service';
import { CreatePaymentClaimDto } from './dto/create-payment-claim.dto';
import { ApprovePaymentClaimDto } from './dto/approve-payment-claim.dto';
import { RejectPaymentClaimDto } from './dto/reject-payment-claim.dto';
import { PaymentClaimQueryDto } from './dto/payment-claim-query.dto';

/** Addendum 4 / A12 — parent "already paid elsewhere" claims + the accountant review queue. */
@Controller('payment-claims')
export class PaymentClaimsController {
  constructor(private readonly paymentClaimsService: PaymentClaimsService) {}

  @Post()
  @Roles(Role.parent)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreatePaymentClaimDto,
  ) {
    return this.paymentClaimsService.create(tenantId, user.id, dto);
  }

  /** A parent's own submissions, so they can see what's pending/approved/rejected. */
  @Get('mine')
  @Roles(Role.parent)
  findMine(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.paymentClaimsService.findMine(tenantId, user.id);
  }

  /** Accountant/admin review queue — defaults to the pending backlog. */
  @Get()
  @Roles(Role.admin, Role.accounts)
  findAll(@TenantId() tenantId: string, @Query() query: PaymentClaimQueryDto) {
    return this.paymentClaimsService.findAll(tenantId, query.status);
  }

  @Get(':id/proof-url')
  @Roles(Role.admin, Role.accounts, Role.parent)
  getProofUrl(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentClaimsService.getProofUrl(tenantId, id, user);
  }

  @Post(':id/approve')
  @Roles(Role.admin, Role.accounts)
  approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovePaymentClaimDto,
  ) {
    return this.paymentClaimsService.approve(tenantId, id, dto, user.id);
  }

  @Post(':id/reject')
  @Roles(Role.admin, Role.accounts)
  reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentClaimDto,
  ) {
    return this.paymentClaimsService.reject(tenantId, id, dto, user.id);
  }
}
