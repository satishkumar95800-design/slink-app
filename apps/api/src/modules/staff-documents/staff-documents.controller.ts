import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import type { Express } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FolderNameDto } from './dto/staff-documents.dto';
import { StaffDocumentsService } from './staff-documents.service';

/** Shared staff folders and files. Parents and the developer role get nothing. */
@Controller('staff-documents')
@Roles(Role.teacher, Role.admin, Role.accounts, Role.super_admin)
export class StaffDocumentsController {
  constructor(private readonly docs: StaffDocumentsService) {}

  @Get('folders')
  listFolders(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.docs.listFolders(tenantId, user);
  }

  @Post('folders')
  createFolder(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: FolderNameDto,
  ) {
    return this.docs.createFolder(tenantId, user, dto.name);
  }

  @Patch('folders/:id')
  renameFolder(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FolderNameDto,
  ) {
    return this.docs.renameFolder(tenantId, user, id, dto.name);
  }

  @Delete('folders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFolder(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.docs.deleteFolder(tenantId, user, id);
  }

  @Get('folders/:id/files')
  listFiles(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.docs.listFiles(tenantId, user, id);
  }

  @Post('folders/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.docs.upload(tenantId, user, id, file);
  }

  @Get('folders/:id/files/:fileId/url')
  fileUrl(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.docs.fileUrl(tenantId, id, fileId);
  }

  @Delete('folders/:id/files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    await this.docs.deleteFile(tenantId, user, id, fileId);
  }
}
