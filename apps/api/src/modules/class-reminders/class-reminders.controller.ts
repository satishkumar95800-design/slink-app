import { Body, Controller, Get, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ClassRemindersService } from './class-reminders.service';
import { UpdateClassReminderDto } from './dto/update-class-reminder.dto';

/** A teacher's own "next class" reminder setting. */
@Controller('class-reminders')
@Roles(Role.teacher)
export class ClassRemindersController {
  constructor(private readonly service: ClassRemindersService) {}

  @Get('me')
  getMine(@CurrentUser() user: ActiveUser) {
    return this.service.getSetting(user.id);
  }

  @Put('me')
  updateMine(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: UpdateClassReminderDto,
  ) {
    return this.service.updateSetting(tenantId, user.id, dto.minutesBefore);
  }
}
