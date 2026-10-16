import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import type { Express, Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { PrismaService } from '../../prisma/prisma.service';
import { PayeeImportService } from './payee-import.service';
import { PayeeTemplateService } from './payee-template.service';
import { PAYEE_TEMPLATE_FILE_NAME } from './payee-tab-schema';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

/**
 * Separate import for vendors and ground staff into the petty-cash payee list.
 * Same audience as the payee endpoints (admin, accounts, super_admin) and the
 * same `pettyCash` flag: every route answers 403 FEATURE_DISABLED when it is off.
 * The tenant comes from TenantMiddleware (super_admin via X-Tenant-ID), never the body.
 */
@Controller('imports/payees')
@Roles(Role.admin, Role.accounts, Role.super_admin)
export class PayeeImportController {
  constructor(
    private readonly importer: PayeeImportService,
    private readonly template: PayeeTemplateService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('template')
  async downloadTemplate(@TenantId() tenantId: string, @Res() res: Response) {
    await this.assertEnabled(tenantId);
    const buffer = await this.template.generate();
    res.set({
      'Content-Type': XLSX_MIME_TYPE,
      'Content-Disposition': `attachment; filename="${PAYEE_TEMPLATE_FILE_NAME}"`,
    });
    res.send(buffer);
  }

  /** Dry run: per-row errors and warnings, nothing is written. */
  @Post('validate')
  @UseInterceptors(uploadInterceptor)
  async validate(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
  ) {
    await this.assertEnabled(tenantId);
    return this.importer.validate(tenantId, this.requireXlsx(file));
  }

  /** All-or-nothing: 422 with the validation report if any row has an error. */
  @Post('commit')
  @UseInterceptors(uploadInterceptor)
  async commit(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
  ) {
    await this.assertEnabled(tenantId);
    return this.importer.commit(tenantId, user, this.requireXlsx(file));
  }

  private assertEnabled(tenantId: string) {
    return assertFeatureEnabled(this.prisma, tenantId, 'pettyCash');
  }

  private requireXlsx(file: Express.Multer.File): Buffer {
    if (!file) throw new BadRequestException('No file provided');
    if (file.mimetype !== XLSX_MIME_TYPE) {
      throw new BadRequestException('Only .xlsx files are accepted');
    }
    return file.buffer;
  }
}
