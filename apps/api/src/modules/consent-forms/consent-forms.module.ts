import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsentFormsController } from './consent-forms.controller';
import { ConsentFormsService } from './consent-forms.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ConsentFormsController],
  providers: [ConsentFormsService],
})
export class ConsentFormsModule {}
