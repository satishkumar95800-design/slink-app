import { Module } from '@nestjs/common';
import {
  GroupsController,
  HeadOfficeController,
} from './head-office.controller';
import { GroupsService } from './groups.service';
import { HeadOfficeService } from './head-office.service';

@Module({
  controllers: [HeadOfficeController, GroupsController],
  providers: [HeadOfficeService, GroupsService],
})
export class HeadOfficeModule {}
