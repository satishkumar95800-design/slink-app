import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Exchange a Firebase Phone Auth ID token for our JWT pair.
   * Tenant is resolved from X-Tenant-ID header by TenantMiddleware.
   */
  @Public()
  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@TenantId() tenantId: string, @Body() dto: VerifyOtpDto) {
    return this.authService.verifyPhoneOtp(tenantId, dto);
  }

  /**
   * Checked by the mobile app before triggering Firebase's OTP send, so an
   * unregistered number never gets an SMS or a code-entry screen at all.
   */
  @Public()
  @Post('phone/check')
  @HttpCode(HttpStatus.OK)
  checkPhone(@TenantId() tenantId: string, @Body() dto: CheckPhoneDto) {
    return this.authService.checkPhoneExists(tenantId, dto);
  }

  /**
   * Email + password login for teachers and admin/accounts staff.
   */
  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  emailLogin(@TenantId() tenantId: string, @Body() dto: EmailLoginDto) {
    return this.authService.emailLogin(tenantId, dto);
  }

  /**
   * Email + password login for super_admin — no X-Tenant-ID required; the account
   * is located by email + role across all tenants.
   */
  @Public()
  @Post('super-admin/login')
  @HttpCode(HttpStatus.OK)
  superAdminLogin(@Body() dto: SuperAdminLoginDto) {
    return this.authService.superAdminLogin(dto);
  }

  /**
   * Rotate refresh token — returns a new JWT pair.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * Revoke the supplied refresh token (logout from this device).
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }

  /**
   * Revoke all refresh tokens for the authenticated user (logout everywhere).
   */
  @Post('logout/all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: { id: string }) {
    await this.authService.logoutAll(user.id);
  }

  /**
   * Return the current authenticated user's profile.
   */
  @Get('me')
  async me(@CurrentUser() user: ActiveUser) {
    return { success: true, data: await this.authService.me(user) };
  }
}
