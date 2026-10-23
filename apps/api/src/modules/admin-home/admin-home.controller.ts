import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { AdminHomeService } from './admin-home.service';

@Controller('admin-home')
export class AdminHomeController {
  constructor(private readonly home: AdminHomeService) {}

  /** The admin's mobile home: today's numbers. */
  @Get()
  @Roles(Role.admin)
  get(@TenantId() tenantId: string) {
    return this.home.home(tenantId);
  }
}
