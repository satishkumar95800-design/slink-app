import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Role } from '@prisma/client';
import { FeeStructuresService } from './fee-structures.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { FeeStructureQueryDto } from './dto/fee-structure-query.dto';
import { AssignFeeStructureDto } from './dto/assign-fee-structure.dto';
import type { ActiveUser } from '../../common/types/active-user.type';

@Controller('fee-structures')
export class FeeStructuresController {
  constructor(private readonly feeStructuresService: FeeStructuresService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Query() query: FeeStructureQueryDto,
  ) {
    return this.feeStructuresService.findAll(tenantId, user, query);
  }

  @Get(':id')
  @Roles(Role.admin, Role.accounts, Role.teacher)
  findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: ActiveUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.feeStructuresService.findOne(tenantId, id, user);
  }

  @Post()
  @Roles(Role.admin, Role.accounts)
  create(@TenantId() tenantId: string, @Body() dto: CreateFeeStructureDto) {
    return this.feeStructuresService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.accounts)
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeeStructureDto,
  ) {
    return this.feeStructuresService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.feeStructuresService.remove(tenantId, id);
  }

  @Post(':id/assign-class')
  @Roles(Role.admin, Role.accounts)
  @HttpCode(HttpStatus.OK)
  assignToClass(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignFeeStructureDto,
    @CurrentUser() user: ActiveUser,
  ) {
    return this.feeStructuresService.assignToClass(tenantId, id, dto, user);
  }
}
