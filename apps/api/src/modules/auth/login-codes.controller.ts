import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { LoginCodesSettingDto } from './dto/login-code.dto';
import { LoginCodesService } from './login-codes.service';

/** Settings → Sign-in security: the school admin switches emailed sign-in codes (Premium Max). */
@Controller('security/login-codes')
@UseGuards(FeatureGuard('loginCodes'))
export class LoginCodesController {
  constructor(private readonly loginCodes: LoginCodesService) {}

  @Get()
  @Roles(Role.admin, Role.super_admin)
  get(@TenantId() tenantId: string) {
    return this.loginCodes.setting(tenantId);
  }

  @Put()
  @Roles(Role.admin, Role.super_admin)
  set(@TenantId() tenantId: string, @Body() dto: LoginCodesSettingDto) {
    return this.loginCodes.setEnabled(tenantId, dto.enabled);
  }
}
