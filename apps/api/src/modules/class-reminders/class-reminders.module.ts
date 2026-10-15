import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClassRemindersController } from './class-reminders.controller';
import { ClassRemindersService } from './class-reminders.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ClassRemindersController],
  providers: [ClassRemindersService],
})
export class ClassRemindersModule {}
