import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ImportsService } from './imports.service';
import { TemplateGeneratorService } from './template-generator.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ImportCleanupService } from './import-cleanup.service';
import { PrismaService } from '../../prisma/prisma.service';
import { assertFeatureEnabled } from '../../common/tenant-features';
import type { Express, Response } from 'express';

const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

@Controller('imports')
@Roles(Role.admin, Role.super_admin)
export class ImportsController {
  constructor(
    private readonly importsService: ImportsService,
    private readonly templateGenerator: TemplateGeneratorService,
    private readonly cleanup: ImportCleanupService,
    private readonly prisma: PrismaService,
  ) {}

  /** Downloads a ready-to-fill .xlsx template with all 5 tabs, headers, and one example row each. */
  @Get('template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.templateGenerator.generate();
    res.set({
      'Content-Type': XLSX_MIME_TYPE,
      'Content-Disposition':
        'attachment; filename="school-onboarding-template.xlsx"',
    });
    res.send(buffer);
  }

  /**
   * Parses and validates a bulk-onboarding workbook without writing anything to the
   * database. Returns a per-tab report of row counts, errors, and warnings.
   */
  @Post('validate')
  @UseInterceptors(uploadInterceptor)
  async validate(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
  ) {
    return this.importsService.validate(this.requireXlsx(file), tenantId);
  }

  /**
   * Premium (docs/SPEC-ai.md 3.3): returns a cleaned copy of the file (base64)
   * and the list of changes. Nothing is written; the client validates the copy.
   */
  @Post('fix')
  @UseInterceptors(uploadInterceptor)
  async fix(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
  ) {
    await assertFeatureEnabled(this.prisma, tenantId, 'aiInsights');
    return this.cleanup.fix(tenantId, this.requireXlsx(file));
  }

  /**
   * Re-validates and, if there are zero errors, writes the file. Files within the
   * sync row limit commit immediately; larger files are queued — poll GET /imports/:jobId
   * for status. Stateless like /validate — the client re-uploads the same file it validated.
   */
  @Post('commit')
  @UseInterceptors(uploadInterceptor)
  async commit(
    @UploadedFile() file: Express.Multer.File,
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.importsService.commit(
      tenantId,
      user.id,
      file?.originalname ?? 'upload.xlsx',
      this.requireXlsx(file),
    );
  }

  /** Poll for the status/summary of a queued (or completed) import job. */
  @Get(':jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @TenantId() tenantId: string,
  ) {
    return this.importsService.getJobStatus(tenantId, jobId);
  }

  private requireXlsx(file: Express.Multer.File): Buffer {
    if (!file) throw new BadRequestException('No file provided');
    if (file.mimetype !== XLSX_MIME_TYPE) {
      throw new BadRequestException('Only .xlsx files are accepted');
    }
    return file.buffer;
  }
}
