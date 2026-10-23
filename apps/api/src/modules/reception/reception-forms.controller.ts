import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import type { Express, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { ReceptionFormDto } from './dto/reception-forms.dto';
import { ReceptionFormsService } from './reception-forms.service';

/** Front desk forms to print for visitors and parents (flag `admissions`). */
@Controller('reception/forms')
@Roles(Role.receptionist, Role.admin, Role.accounts, Role.super_admin)
@UseGuards(FeatureGuard('admissions'))
export class ReceptionFormsController {
  constructor(private readonly forms: ReceptionFormsService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.forms.list(tenantId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  upload(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ReceptionFormDto,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.forms.upload(tenantId, user, file, dto);
  }

  @Patch(':id')
  rename(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceptionFormDto,
  ) {
    return this.forms.rename(tenantId, user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.forms.remove(tenantId, user.id, id);
  }

  /** Shown inline, so the console can open or print it. */
  @Get(':id/file')
  async file(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const f = await this.forms.file(tenantId, id);
    res.set({
      'Content-Type': f.contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(f.body);
  }
}
