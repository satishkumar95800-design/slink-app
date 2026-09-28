import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { DocumentCategoriesService } from './document-categories.service';
import { CreateDocumentCategoryDto } from './dto/create-document-category.dto';
import { UpdateDocumentCategoryDto } from './dto/update-document-category.dto';

@Controller('document-categories')
export class DocumentCategoriesController {
  constructor(private readonly documentCategoriesService: DocumentCategoriesService) {}

  @Get()
  @Roles(Role.admin, Role.accounts)
  findAll(@TenantId() tenantId: string) {
    return this.documentCategoriesService.findAll(tenantId);
  }

  @Post()
  @Roles(Role.admin)
  create(@TenantId() tenantId: string, @Body() dto: CreateDocumentCategoryDto) {
    return this.documentCategoriesService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentCategoryDto,
  ) {
    return this.documentCategoriesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.documentCategoriesService.remove(tenantId, id);
  }
}
