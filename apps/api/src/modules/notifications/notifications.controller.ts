import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { NotificationsService } from './notifications.service';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Admin/accounts broadcast to a class, all parents, or a specific user.
   * Teachers may also call this, but only with targetType 'class' for a class they own.
   */
  @Post('broadcast')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  @HttpCode(HttpStatus.OK)
  broadcast(
    @TenantId() tenantId: string,
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.notificationsService.broadcast(tenantId, dto, user);
  }

  /**
   * Audit log — list sent notifications for the tenant.
   */
  @Get()
  @Roles(Role.admin, Role.accounts)
  findAll(@TenantId() tenantId: string, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(tenantId, query);
  }

  /**
   * Mobile app registers an FCM token after login.
   * Any authenticated role can call this (parent, teacher, admin).
   */
  @Post('fcm-token')
  @Roles(Role.parent, Role.teacher, Role.admin, Role.accounts)
  @HttpCode(HttpStatus.NO_CONTENT)
  registerFcmToken(
    @CurrentUser() user: ActiveUser,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    return this.notificationsService.registerFcmToken(user.id, dto.token);
  }

  /**
   * Mobile app removes its FCM token on logout.
   */
  @Delete('fcm-token')
  @Roles(Role.parent, Role.teacher, Role.admin, Role.accounts)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFcmToken(
    @CurrentUser() user: ActiveUser,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    return this.notificationsService.removeFcmToken(user.id, dto.token);
  }
}
