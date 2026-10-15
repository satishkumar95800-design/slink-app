import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentGatewayService } from './payment-gateway.service';
import { SetPaymentGatewayDto } from './dto/set-payment-gateway.dto';

/** Platform console: a school's Razorpay keys. Secrets are write-only. */
@Controller('tenants/:id/payment-gateway')
@Roles(Role.super_admin)
export class PaymentGatewayController {
  constructor(private readonly service: PaymentGatewayService) {}

  @Get()
  status(@Param('id', ParseUUIDPipe) tenantId: string) {
    return this.service.status(tenantId);
  }

  @Put()
  set(
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetPaymentGatewayDto,
  ) {
    return this.service.set(tenantId, dto);
  }

  @Delete()
  remove(@Param('id', ParseUUIDPipe) tenantId: string) {
    return this.service.remove(tenantId);
  }
}
