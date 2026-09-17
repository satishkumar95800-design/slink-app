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
import { DiscountTypesService } from './discount-types.service';
import { CreateDiscountTypeDto } from './dto/create-discount-type.dto';
import { UpdateDiscountTypeDto } from './dto/update-discount-type.dto';

@Controller('discount-types')
export class DiscountTypesController {
  constructor(private readonly discountTypesService: DiscountTypesService) {}

  @Get()
  @Roles(Role.admin, Role.accounts)
  findAll(@TenantId() tenantId: string) {
    return this.discountTypesService.findAll(tenantId);
  }

  @Post()
  @Roles(Role.admin)
  create(@TenantId() tenantId: string, @Body() dto: CreateDiscountTypeDto) {
    return this.discountTypesService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountTypeDto,
  ) {
    return this.discountTypesService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.discountTypesService.remove(tenantId, id);
  }
}
