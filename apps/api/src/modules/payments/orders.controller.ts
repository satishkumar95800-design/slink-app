import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('payments/orders')
export class OrdersController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.parent)
  createOrder(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateOrderDto,
  ) {
    return this.paymentsService.createOrder(tenantId, dto, user);
  }

  @Get()
  @Roles(Role.admin, Role.accounts, Role.parent)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.paymentsService.findAll(tenantId, user, query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.accounts, Role.parent)
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.findOne(tenantId, id, user);
  }
}
