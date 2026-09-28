import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { TeacherDashboardService } from './teacher-dashboard.service';

@Controller('teacher-dashboard')
export class TeacherDashboardController {
  constructor(private readonly service: TeacherDashboardService) {}

  /** Addendum 4 / A10 — "About My Class(es)" section of the teacher dashboard. */
  @Get('my-classes')
  @Roles(Role.teacher)
  getMyClasses(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.service.getMyClasses(tenantId, user.id);
  }

  /** Addendum 4 / A14 — Admin Dashboard "Teacher Workload" widget. Admin-only per the spec — not accounts/super_admin. */
  @Get('workload')
  @Roles(Role.admin)
  getWorkload(@TenantId() tenantId: string) {
    return this.service.getWorkload(tenantId);
  }
}
