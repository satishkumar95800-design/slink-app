import { Module } from '@nestjs/common';
import { TeacherDashboardService } from './teacher-dashboard.service';
import { TeacherDashboardController } from './teacher-dashboard.controller';

@Module({
  controllers: [TeacherDashboardController],
  providers: [TeacherDashboardService],
})
export class TeacherDashboardModule {}
