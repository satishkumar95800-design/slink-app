import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

/**
 * Hidden developer/super_admin audit trail — cross-tenant, excluded from
 * TenantMiddleware (see app.module.ts), no nav entry in web-admin.
 */
@Controller('dev/audit-logs')
@Roles(Role.developer, Role.super_admin)
export class DevAuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogsService.findAll(query);
  }
}
