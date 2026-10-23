import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
  CallDto,
  DayQueryDto,
  DeskPaymentDto,
  DocumentDto,
  FollowUpDoneDto,
  FollowUpInputDto,
  PaymentsQueryDto,
  VisitorDto,
  VoidDto,
} from './dto/reception.dto';
import { ReceptionService } from './reception.service';

/** Front desk (part of the `admissions` flag). */
@Controller('reception')
@Roles(Role.receptionist, Role.admin, Role.accounts, Role.super_admin)
@UseGuards(FeatureGuard('admissions'))
export class ReceptionController {
  constructor(private readonly reception: ReceptionService) {}

  @Get('today')
  today(@TenantId() tenantId: string) {
    return this.reception.today(tenantId);
  }

  @Get('enquiries/:id')
  enquiryDesk(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reception.enquiryDesk(tenantId, id);
  }

  @Post('enquiries/:id/follow-ups')
  addFollowUp(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FollowUpInputDto,
  ) {
    return this.reception.addFollowUp(tenantId, user, id, dto);
  }

  @Post('follow-ups/:id/done')
  @HttpCode(HttpStatus.OK)
  done(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FollowUpDoneDto,
  ) {
    return this.reception.setFollowUpDone(
      tenantId,
      user,
      id,
      true,
      dto.outcome,
    );
  }

  @Post('follow-ups/:id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reception.setFollowUpDone(tenantId, user, id, false);
  }

  @Put('enquiries/:id/documents/:kind')
  document(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('kind') kind: string,
    @Body() dto: DocumentDto,
  ) {
    return this.reception.setDocument(tenantId, user, id, kind, dto);
  }

  @Post('enquiries/:id/payments')
  addPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeskPaymentDto,
  ) {
    return this.reception.addPayment(tenantId, user, id, dto);
  }

  @Get('payments')
  payments(@TenantId() tenantId: string, @Query() q: PaymentsQueryDto) {
    return this.reception.payments(tenantId, q.from, q.to);
  }

  @Get('payments/:id')
  receipt(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reception.receipt(tenantId, id);
  }

  /** Admin and accounts only (checked in the service). */
  @Post('payments/:id/void')
  @HttpCode(HttpStatus.OK)
  voidPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidDto,
  ) {
    return this.reception.voidPayment(tenantId, user, id, dto.reason);
  }

  @Get('visitors')
  visitors(@TenantId() tenantId: string, @Query() q: DayQueryDto) {
    return this.reception.visitors(tenantId, q.date);
  }

  @Post('visitors')
  signIn(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: VisitorDto,
  ) {
    return this.reception.signIn(tenantId, user, dto);
  }

  @Post('visitors/:id/out')
  @HttpCode(HttpStatus.OK)
  signOut(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reception.signOut(tenantId, user, id);
  }

  @Get('calls')
  calls(@TenantId() tenantId: string, @Query() q: DayQueryDto) {
    return this.reception.calls(tenantId, q.date);
  }

  @Post('calls')
  logCall(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CallDto,
  ) {
    return this.reception.logCall(tenantId, user, dto);
  }
}
