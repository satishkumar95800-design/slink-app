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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AlbumDto, PhotoMetaDto } from './dto/photo-albums.dto';
import { PhotoAlbumsService } from './photo-albums.service';

const STAFF = [Role.admin, Role.teacher, Role.super_admin] as const;
/** Everyone who can open the staff folder. */
const STAFF_VIEW = [...STAFF, Role.accounts] as const;

/** Activity photo albums for parents (flag photoAlbums, Premium Max). */
@Controller('albums')
@UseGuards(FeatureGuard('photoAlbums'))
export class PhotoAlbumsController {
  constructor(private readonly albums: PhotoAlbumsService) {}

  // ── Parent (fixed paths first) ──

  @Get('child/:studentId')
  @Roles(Role.parent)
  forChild(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.albums.forChild(tenantId, user.id, studentId);
  }

  @Get('child/:studentId/:id')
  @Roles(Role.parent)
  viewForChild(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.viewForChild(tenantId, user.id, studentId, id);
  }

  @Post('child/:studentId/:id/saved')
  @Roles(Role.parent)
  @HttpCode(HttpStatus.OK)
  saved(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.markSaved(tenantId, user.id, studentId, id);
  }

  // ── Staff ──

  @Get()
  @Roles(...STAFF_VIEW)
  list(@TenantId() tenantId: string, @CurrentUser() user: ActiveUser) {
    return this.albums.list(tenantId, user);
  }

  @Post()
  @Roles(...STAFF)
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: AlbumDto,
  ) {
    return this.albums.create(tenantId, user, dto);
  }

  @Get(':id')
  @Roles(...STAFF_VIEW)
  detail(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.detail(tenantId, user, id);
  }

  @Patch(':id')
  @Roles(...STAFF)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AlbumDto,
  ) {
    return this.albums.update(tenantId, user, id, dto);
  }

  @Delete(':id')
  @Roles(...STAFF)
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.remove(tenantId, user, id);
  }

  /** One photo (resized on the device) and its thumbnail. */
  @Post(':id/photos')
  @Roles(...STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'thumb', maxCount: 1 },
      ],
      { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } },
    ),
  )
  addPhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles()
    files: { photo?: Express.Multer.File[]; thumb?: Express.Multer.File[] },
    @Body() meta: PhotoMetaDto,
  ) {
    const photo = files?.photo?.[0];
    const thumb = files?.thumb?.[0];
    if (!photo || !thumb)
      throw new BadRequestException('Send the photo and its thumbnail');
    return this.albums.addPhoto(tenantId, user, id, photo, thumb, meta);
  }

  @Delete(':id/photos/:photoId')
  @Roles(...STAFF)
  removePhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.albums.removePhoto(tenantId, user, id, photoId);
  }

  @Post(':id/publish')
  @Roles(...STAFF)
  @HttpCode(HttpStatus.OK)
  publish(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.publish(tenantId, user, id);
  }

  /** A staff login saved photos (the "saved by" count). */
  @Post(':id/saved')
  @Roles(...STAFF_VIEW)
  @HttpCode(HttpStatus.OK)
  savedByStaff(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.markSavedByStaff(tenantId, user, id);
  }

  @Post(':id/extend')
  @Roles(Role.admin, Role.super_admin)
  @HttpCode(HttpStatus.OK)
  extend(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.albums.extend(tenantId, user, id);
  }
}
