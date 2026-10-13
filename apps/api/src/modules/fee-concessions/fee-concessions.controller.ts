import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FeeConcessionsService } from './fee-concessions.service';
import { CreateFeeConcessionDto } from './dto/create-fee-concession.dto';

@Controller('fee-concessions')
@Roles(Role.admin, Role.accounts)
export class FeeConcessionsController {
  constructor(private readonly service: FeeConcessionsService) {}

  @Get()
  findForStudent(
    @TenantId() tenantId: string,
    @Query('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.service.findForStudent(tenantId, studentId);
  }

  /** Dashboard: total concession given today. */
  @Get('today')
  today(@TenantId() tenantId: string) {
    return this.service.todayTotal(tenantId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateFeeConcessionDto,
  ) {
    return this.service.create(tenantId, dto, user.id);
  }
}
