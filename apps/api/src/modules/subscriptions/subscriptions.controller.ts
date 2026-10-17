import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  RenewSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/subscriptions.dto';
import { SubscriptionsService } from './subscriptions.service';

/** Platform team only; excluded from TenantMiddleware (no X-Tenant-ID). */
@Controller()
@Roles(Role.super_admin)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Patch('tenants/:id/subscription')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.subscriptions.update(id, dto, user);
  }

  @Post('tenants/:id/renew')
  @HttpCode(200)
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewSubscriptionDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.subscriptions.renew(id, dto, user);
  }

  @Get('tenants/:id/renewals')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.history(id);
  }

  @Get('platform/renewals')
  renewals() {
    return this.subscriptions.renewals();
  }
}
