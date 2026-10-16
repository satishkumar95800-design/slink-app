import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeeImportService } from './employee-import.service';
import { EmployeesService } from './employees.service';
import { HrCrypto } from './hr-crypto.service';
import { HrSettingsService } from './hr-settings.service';
import { HrmsFeatureGuard } from './hrms-feature.guard';
import { HrmsMeController } from './hrms-me.controller';
import { HrmsController } from './hrms.controller';
import { LeaveService } from './leave.service';
import { MeService } from './me.service';
import { PayrollService } from './payroll.service';
import { StaffAttendanceService } from './staff-attendance.service';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [HrmsController, HrmsMeController],
  providers: [
    HrCrypto,
    HrSettingsService,
    EmployeesService,
    EmployeeImportService,
    StaffAttendanceService,
    LeaveService,
    PayrollService,
    MeService,
    HrmsFeatureGuard,
  ],
})
export class HrmsModule {}
