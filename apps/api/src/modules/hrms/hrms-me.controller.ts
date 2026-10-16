import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ApplyLeaveDto } from './dto/hrms.dto';
import { HrmsFeatureGuard } from './hrms-feature.guard';
import { MeService } from './me.service';

/**
 * Mobile self-service for staff with a linked employee record. No route takes
 * an employee id: everything is the caller's own data. Parents and the
 * developer role are refused at the roles guard.
 */
@Controller('hrms/me')
@Roles(Role.teacher, Role.admin, Role.accounts)
@UseGuards(HrmsFeatureGuard)
export class HrmsMeController {
  constructor(private readonly me: MeService) {}

  @Get()
  profile(@CurrentUser() user: ActiveUser) {
    return this.me.profile(user);
  }

  @Get('payslips')
  payslips(@CurrentUser() user: ActiveUser) {
    return this.me.payslips(user);
  }

  @Get('payslips/:id/pdf')
  async payslipPdf(
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdf, filename } = await this.me.payslipPdf(user, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(pdf);
  }

  @Get('leave/types')
  leaveTypes(@CurrentUser() user: ActiveUser) {
    return this.me.leaveTypes(user);
  }

  @Get('leave/balances')
  balances(@CurrentUser() user: ActiveUser) {
    return this.me.balances(user);
  }

  @Get('leave/requests')
  requests(@CurrentUser() user: ActiveUser) {
    return this.me.requests(user);
  }

  @Post('leave/requests')
  apply(@CurrentUser() user: ActiveUser, @Body() dto: ApplyLeaveDto) {
    return this.me.apply(user, dto);
  }

  @Post('leave/requests/:id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.me.cancel(user, id);
  }
}
