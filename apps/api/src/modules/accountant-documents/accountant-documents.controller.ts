import { Controller, Get, Post, Delete, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AccountantDocumentsService } from './accountant-documents.service';
import { CreateAccountantDocumentDto } from './dto/create-accountant-document.dto';

@Controller('accountant-documents')
@Roles(Role.admin, Role.accounts)
export class AccountantDocumentsController {
  constructor(private readonly accountantDocumentsService: AccountantDocumentsService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.accountantDocumentsService.findAll(tenantId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Body() dto: CreateAccountantDocumentDto,
  ) {
    return this.accountantDocumentsService.create(tenantId, user.id, dto);
  }

  @Get(':id/signed-url')
  async getSignedUrl(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    const url = await this.accountantDocumentsService.getSignedUrl(tenantId, id);
    return { url };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.accountantDocumentsService.remove(tenantId, id);
  }
}
