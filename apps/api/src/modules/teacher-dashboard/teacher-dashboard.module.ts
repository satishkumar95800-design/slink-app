import { Module } from '@nestjs/common';
import { TeacherDashboardService } from './teacher-dashboard.service';
import { TeacherDashboardController } from './teacher-dashboard.controller';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';

@Module({
  imports: [BroadcastsModule],
  controllers: [TeacherDashboardController],
  providers: [TeacherDashboardService],
})
export class TeacherDashboardModule {}
