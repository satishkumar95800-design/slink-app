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
import { CustomFieldDefinitionsService } from './custom-field-definitions.service';
import { CreateCustomFieldDefinitionDto } from './dto/create-custom-field-definition.dto';
import { UpdateCustomFieldDefinitionDto } from './dto/update-custom-field-definition.dto';

@Controller('custom-field-definitions')
export class CustomFieldDefinitionsController {
  constructor(private readonly service: CustomFieldDefinitionsService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher)
  findAll(@TenantId() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Post()
  @Roles(Role.admin)
  create(@TenantId() tenantId: string, @Body() dto: CreateCustomFieldDefinitionDto) {
    return this.service.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDefinitionDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.service.remove(tenantId, id);
  }
}
