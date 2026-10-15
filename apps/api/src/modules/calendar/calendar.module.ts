import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [AttendanceModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
