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
import { TransportSlabsService } from './transport-slabs.service';
import { CreateTransportSlabDto } from './dto/create-transport-slab.dto';
import { UpdateTransportSlabDto } from './dto/update-transport-slab.dto';

@Controller('transport-slabs')
export class TransportSlabsController {
  constructor(private readonly transportSlabsService: TransportSlabsService) {}

  @Get()
  @Roles(Role.admin, Role.accounts)
  findAll(@TenantId() tenantId: string) {
    return this.transportSlabsService.findAll(tenantId);
  }

  @Post()
  @Roles(Role.admin)
  create(@TenantId() tenantId: string, @Body() dto: CreateTransportSlabDto) {
    return this.transportSlabsService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransportSlabDto,
  ) {
    return this.transportSlabsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.transportSlabsService.remove(tenantId, id);
  }
}
