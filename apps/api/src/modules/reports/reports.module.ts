import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
