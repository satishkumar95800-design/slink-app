import { Module } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { DevAuditLogsController } from './dev-audit-logs.controller';

@Module({
  controllers: [DevAuditLogsController],
  providers: [AuditLogsService],
})
export class AuditModule {}
