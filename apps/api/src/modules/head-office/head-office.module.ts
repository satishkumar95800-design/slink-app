import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CircularsService } from './circulars.service';
import { GroupsService } from './groups.service';
import {
  GroupsController,
  HeadOfficeController,
  SchoolCircularsController,
} from './head-office.controller';
import { HeadOfficeService } from './head-office.service';

@Module({
  imports: [NotificationsModule],
  controllers: [
    HeadOfficeController,
    GroupsController,
    SchoolCircularsController,
  ],
  providers: [HeadOfficeService, GroupsService, CircularsService],
})
export class HeadOfficeModule {}
