import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { BroadcastsService } from './broadcasts.service';

@Controller('broadcasts')
export class BroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  /** Teacher app "Sent" list: each notice/homework with "Seen by X/Y parents". */
  @Get('sent')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  sent(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.broadcastsService.listSent(tenantId, user);
  }

  @Get(':id/unseen')
  @Roles(Role.teacher, Role.admin, Role.super_admin)
  unseen(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.broadcastsService.listUnseen(tenantId, id, user);
  }

  /** Parent app calls this when the parent opens a notice or homework item. */
  @Post(':id/seen')
  @HttpCode(200)
  @Roles(Role.parent)
  seen(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.broadcastsService.markSeen(tenantId, id, user);
  }
}
