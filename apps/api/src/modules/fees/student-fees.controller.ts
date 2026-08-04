import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Role } from '@prisma/client';
import { StudentFeesService } from './student-fees.service';
import { AssignStudentFeeDto } from './dto/assign-student-fee.dto';
import { RecordOfflinePaymentDto } from './dto/record-offline-payment.dto';
import { AdjustStudentFeeDto } from './dto/adjust-student-fee.dto';
import { StudentFeeQueryDto } from './dto/student-fee-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('student-fees')
export class StudentFeesController {
  constructor(private readonly studentFeesService: StudentFeesService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: StudentFeeQueryDto,
  ) {
    return this.studentFeesService.findAll(tenantId, user, query);
  }

  @Get('outstanding')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  getOutstanding(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: StudentFeeQueryDto,
  ) {
    return this.studentFeesService.getOutstanding(tenantId, user, query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.studentFeesService.findOne(tenantId, id, user);
  }

  @Post()
  @Roles(Role.admin, Role.accounts)
  assign(
    @TenantId() tenantId: string,
    @Body() dto: AssignStudentFeeDto,
  ) {
    return this.studentFeesService.assignOne(tenantId, dto);
  }

  @Post(':id/offline-payment')
  @Roles(Role.admin, Role.accounts)
  @HttpCode(HttpStatus.OK)
  recordOfflinePayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordOfflinePaymentDto,
  ) {
    return this.studentFeesService.recordOfflinePayment(tenantId, id, dto, user.id);
  }

  @Post(':id/adjust')
  @Roles(Role.admin, Role.accounts)
  @HttpCode(HttpStatus.OK)
  adjust(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStudentFeeDto,
  ) {
    return this.studentFeesService.adjust(tenantId, id, dto, user.id);
  }
}
