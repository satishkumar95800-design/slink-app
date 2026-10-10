import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseAdminService } from '../../firebase/firebase-admin.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { effectiveLanguage, isLanguage } from '../../common/i18n/languages';
import type { Language } from '../../common/i18n/languages';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    role: Role;
    tenantId: string;
    /** The user's own pick, or null when they follow the school default. */
    preferredLanguage: string | null;
    /** What the apps should show right after sign-in, even on a new device. */
    language: Language;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Exchange a Firebase Phone Auth ID token for our own JWT pair.
   * The phone must already belong to a user created by the school admin
   * (via student linking or bulk import) — this never self-registers a new
   * parent, so a verified-but-unrecognized phone is rejected rather than
   * silently given an account.
   */
  async verifyPhoneOtp(tenantId: string, dto: VerifyOtpDto): Promise<AuthResult> {
    let phone: string;
    try {
      const decoded = await this.firebaseAdmin.verifyIdToken(dto.firebaseIdToken);
      if (!decoded.phone_number) {
        throw new UnauthorizedException('Firebase token does not contain a phone number');
      }
      phone = decoded.phone_number;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Firebase ID token');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });

    if (!user) {
      throw new ForbiddenException({
        code: 'PHONE_NOT_REGISTERED',
        message:
          'This phone number is not registered — please contact your school admin to add it.',
      });
    }

    if (!user.isVerified) {
      await this.prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
    }

    return this.issueTokens(user, dto.deviceId);
  }

  /**
   * Lets the mobile app check a phone number before spending a Firebase SMS
   * send on it — mirrors the registration check in verifyPhoneOtp above.
   */
  async checkPhoneExists(tenantId: string, dto: CheckPhoneDto): Promise<{ exists: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_phone: { tenantId, phone: dto.phone } },
      select: { id: true },
    });
    return { exists: !!user };
  }

  /**
   * Email + password login for teachers and admin/accounts staff.
   */
  async emailLogin(tenantId: string, dto: EmailLoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    if (user.role === Role.parent) {
      throw new ForbiddenException({
        code: 'PARENT_USE_OTP',
        message: 'Parents must use phone OTP login',
      });
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    return this.issueTokens(user, dto.deviceId);
  }

  /**
   * Email + password login for super_admin — no tenant context, since a super_admin
   * operates across every tenant. Looked up by email + role only, never by tenant_id,
   * so this never trusts a client-supplied tenant like the tenant-scoped login does.
   */
  async superAdminLogin(dto: SuperAdminLoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, role: Role.super_admin },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }

    return this.issueTokens(user, dto.deviceId);
  }

  /**
   * Rotate refresh token — revoke old, issue new pair.
   */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    // Rotate: revoke current token before issuing new one
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, stored.deviceId ?? undefined);
  }

  /**
   * Revoke a specific refresh token (logout from one device).
   */
  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices).
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** GET /auth/me — the signed-in user plus their saved and effective language. */
  async me(user: { id: string; name: string; role: Role; tenantId: string }) {
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { preferredLanguage: true },
    });
    return {
      ...user,
      preferredLanguage: row.preferredLanguage,
      language: await this.languageFor({ tenantId: user.tenantId, preferredLanguage: row.preferredLanguage }),
    };
  }

  /**
   * Hash a plain password for storage (used when admin creates teacher/admin accounts).
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async issueTokens(
    user: {
      id: string;
      tenantId: string;
      role: Role;
      name: string;
      preferredLanguage: string | null;
    },
    deviceId?: string,
  ): Promise<AuthResult> {
    const accessExpiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    // Cast needed: @nestjs/jwt v11 expects ms StringValue, not plain string
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpiresIn as '15m',
    });

    const rawRefreshToken = randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = this.parseExpiry(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash,
        deviceId: deviceId ?? null,
        expiresAt,
      },
    });

    const expiresInSeconds = this.parseExpirySeconds(accessExpiresIn);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        preferredLanguage: user.preferredLanguage,
        language: await this.languageFor(user),
      },
    };
  }

  /** Effective interface language for a user: their pick, else their school's default, else English. */
  async languageFor(user: { tenantId: string; preferredLanguage: string | null }): Promise<Language> {
    if (isLanguage(user.preferredLanguage)) return user.preferredLanguage;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { defaultLanguage: true },
    });
    return effectiveLanguage(null, tenant?.defaultLanguage);
  }

  /** SHA-256 hash of a token string — fast and sufficient for a 128-bit random UUID. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(expiry: string): Date {
    const now = Date.now();
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) throw new Error(`Invalid expiry format: ${expiry}`);
    const [, value, unit] = match;
    const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as string]!;
    return new Date(now + parseInt(value, 10) * ms);
  }

  private parseExpirySeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const [, value, unit] = match;
    const secs = { s: 1, m: 60, h: 3600, d: 86400 }[unit as string]!;
    return parseInt(value, 10) * secs;
  }
}
