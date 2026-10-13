import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { TransferCertificatesService } from './transfer-certificates.service';
import { AttachTransferCertificateDto } from './dto/attach-transfer-certificate.dto';
import { TransferCertificateQueryDto } from './dto/transfer-certificate-query.dto';

@Controller('transfer-certificates')
@Roles(Role.admin, Role.accounts, Role.super_admin)
export class TransferCertificatesController {
  constructor(private readonly service: TransferCertificatesService) {}

  /** Report: students missing (or having) a TC, with counts. */
  @Get()
  list(
    @TenantId() tenantId: string,
    @Query() query: TransferCertificateQueryDto,
  ) {
    return this.service.list(tenantId, query);
  }

  @Put(':studentId')
  attach(
    @TenantId() tenantId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: AttachTransferCertificateDto,
  ) {
    return this.service.attach(tenantId, studentId, dto);
  }

  @Delete(':studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @TenantId() tenantId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    await this.service.remove(tenantId, studentId);
  }
}
