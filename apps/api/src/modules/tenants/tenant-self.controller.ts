import { Controller, Get, Patch, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { TenantsService } from './tenants.service';
import { UpdateTenantSelfDto } from './dto/update-tenant-self.dto';
import { UpdateFeaturesDto } from './dto/update-features.dto';

/**
 * Tenant self-management for admin and accounts roles.
 * Goes through TenantMiddleware — X-Tenant-ID header is required.
 */
@Controller('tenant')
export class TenantSelfController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles(Role.admin, Role.accounts, Role.teacher)
  getSelf(@TenantId() tenantId: string) {
    return this.tenantsService.getSelf(tenantId);
  }

  @Patch()
  @Roles(Role.admin)
  updateSelf(
    @TenantId() tenantId: string,
    @Body() dto: UpdateTenantSelfDto,
  ) {
    return this.tenantsService.updateSelf(tenantId, dto);
  }

  @Patch('features')
  @Roles(Role.admin)
  updateFeatures(
    @TenantId() tenantId: string,
    @Body() dto: UpdateFeaturesDto,
  ) {
    return this.tenantsService.updateFeatures(tenantId, dto);
  }
}
