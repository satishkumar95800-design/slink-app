import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { SchoolBusModule } from '../school-bus/school-bus.module';
import { AdminHomeController } from './admin-home.controller';
import { AdminHomeService } from './admin-home.service';

/** The admin's mobile home (GET /admin-home). */
@Module({
  imports: [AttendanceModule, SchoolBusModule],
  controllers: [AdminHomeController],
  providers: [AdminHomeService],
})
export class AdminHomeModule {}
