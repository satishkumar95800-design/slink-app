import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { SignedUrlQueryDto } from './dto/signed-url-query.dto';
import type { ActiveUser } from '../../common/types/active-user.type';
import type { Express } from 'express';

// 20 MB hard limit at the multer layer (per-category limits enforced in service)
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * Upload a file. Accepted roles depend on category:
   * - logo: admin only (validated in service implicitly via tenant key ownership)
   * - report_pdf: teacher
   * - attachment: any authenticated role
   * Role restriction at controller level: any authenticated user may attempt upload;
   * the service enforces key-path tenant isolation.
   */
  @Post('upload')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  upload(
    @TenantId() tenantId: string,
    @CurrentUser() _user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.filesService.upload(tenantId, file, dto.category, dto.entityId);
  }

  /**
   * Generate a presigned GET URL for a private S3 object.
   * Public objects return their direct URL immediately.
   */
  @Get('signed-url')
  @Roles(Role.admin, Role.accounts, Role.teacher, Role.parent)
  async getSignedUrl(
    @TenantId() tenantId: string,
    @Query() query: SignedUrlQueryDto,
  ) {
    const url = await this.filesService.getSignedUrl(query.key, tenantId, query.expiresIn);
    return { url, expiresIn: query.expiresIn ?? 900 };
  }

  /**
   * Delete a file from S3. Admin and accounts only.
   */
  @Delete()
  @Roles(Role.admin, Role.accounts)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @TenantId() tenantId: string,
    @Query('key') key: string,
  ) {
    if (!key) throw new BadRequestException('key query param is required');
    return this.filesService.delete(key, tenantId);
  }
}
