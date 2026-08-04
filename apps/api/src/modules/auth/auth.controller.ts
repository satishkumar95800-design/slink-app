import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailLoginDto } from './dto/email-login.dto';
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
   * Email + password login for teachers and admin/accounts staff.
   */
  @Public()
  @Post('email/login')
  @HttpCode(HttpStatus.OK)
  emailLogin(@TenantId() tenantId: string, @Body() dto: EmailLoginDto) {
    return this.authService.emailLogin(tenantId, dto);
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
  me(@CurrentUser() user: { id: string; name: string; role: string; tenantId: string }) {
    return { success: true, data: user };
  }
}
