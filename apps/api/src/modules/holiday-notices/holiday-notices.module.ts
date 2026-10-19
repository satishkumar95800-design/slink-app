import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HolidayNoticesService } from './holiday-notices.service';

/** Morning holiday push to parents. */
@Module({
  imports: [NotificationsModule],
  providers: [HolidayNoticesService],
})
export class HolidayNoticesModule {}
