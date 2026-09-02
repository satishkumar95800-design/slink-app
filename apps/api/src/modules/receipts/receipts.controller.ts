import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ReceiptsService } from './receipts.service';

/** Single-receipt fetch for the printable receipt view. Listing lives under /insights/paid-history. */
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

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
