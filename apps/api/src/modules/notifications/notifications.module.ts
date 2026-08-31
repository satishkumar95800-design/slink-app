import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { SmsService } from './sms.service';
import { NotificationsController } from './notifications.controller';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService, SmsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
