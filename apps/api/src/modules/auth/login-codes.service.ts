import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '../public-site/mailer.service';
import type { Language } from '../../common/i18n/languages';
import {
  CODE_MINUTES,
  MAX_SENDS,
  MAX_TRIES,
  RESEND_GAP_SECONDS,
  codeEmail,
  codeMatches,
  hashCode,
  maskEmail,
  needsLoginCode,
  newCode,
} from './login-code';

/** What a password sign-in answers when a code is needed instead of tokens. */
export interface CodeNeeded {
  codeRequired: true;
  challengeId: string;
  sentTo: string;
}

const expired = () =>
  new UnauthorizedException({
    code: 'LOGIN_CODE_EXPIRED',
    message:
      'This code has expired or was tried too often. Sign in again for a new code.',
  });

/** Email code at sign-in (MFA): rules in login-code.ts. */
@Injectable()
export class LoginCodesService {
  private readonly logger = new Logger(LoginCodesService.name);
  private readonly secret: string;
  /** LOGIN_CODES_PLATFORM=off is the emergency switch if email breaks. */
  private readonly platformCodes: boolean;
  private readonly production: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
    this.platformCodes = config.get<string>('LOGIN_CODES_PLATFORM') !== 'off';
    this.production = config.get<string>('NODE_ENV') === 'production';
  }

  async isRequired(user: { role: Role; tenantId: string }): Promise<boolean> {
    const school = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { features: true, loginCodes: true },
    });
    return needsLoginCode(user.role, school, this.platformCodes);
  }

  /** Whether codes can actually be emailed from this server. */
  get mailReady(): boolean {
    return this.mailer.enabled;
  }

  /** Creates a challenge for a user whose password was right and emails the code. */
  async start(
    user: { id: string; email: string | null },
    language: Language,
    deviceId?: string,
  ): Promise<CodeNeeded> {
    if (!user.email) throw this.notSent();
    // Old, finished challenges of this user are of no further use.
    await this.prisma.loginChallenge.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });
    const challenge = await this.prisma.loginChallenge.create({
      data: {
        userId: user.id,
        codeHash: '',
        expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
        deviceId: deviceId ?? null,
      },
      select: { id: true },
    });
    try {
      await this.sendCode(challenge.id, user.email, language);
    } catch (err) {
      await this.prisma.loginChallenge.delete({ where: { id: challenge.id } });
      throw err;
    }
    return {
      codeRequired: true,
      challengeId: challenge.id,
      sentTo: maskEmail(user.email),
    };
  }

  /** Checks a code; returns the user to issue tokens for. Single use, MAX_TRIES tries. */
  async verify(challengeId: string, code: string) {
    // Count the try first, atomically, so parallel guesses can't exceed the limit.
    const counted = await this.prisma.loginChallenge.updateMany({
      where: {
        id: challengeId,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: MAX_TRIES },
      },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) throw expired();
    const challenge = await this.prisma.loginChallenge.findUniqueOrThrow({
      where: { id: challengeId },
      include: { user: true },
    });
    if (!codeMatches(this.secret, challengeId, code, challenge.codeHash)) {
      const triesLeft = MAX_TRIES - challenge.attempts;
      if (triesLeft <= 0) throw expired();
      throw new UnauthorizedException({
        code: 'LOGIN_CODE_WRONG',
        message: `That code is not right. ${triesLeft} tries left.`,
        triesLeft,
      });
    }
    const used = await this.prisma.loginChallenge.updateMany({
      where: { id: challengeId, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count === 0) throw expired();
    return { user: challenge.user, deviceId: challenge.deviceId ?? undefined };
  }

  /** A fresh code for the same sign-in (the earlier one stops working). */
  async resend(
    challengeId: string,
    language: (userId: string) => Promise<Language>,
  ) {
    const challenge = await this.prisma.loginChallenge.findUnique({
      where: { id: challengeId },
      include: { user: { select: { id: true, email: true } } },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt < new Date() ||
      challenge.attempts >= MAX_TRIES
    )
      throw expired();
    if (challenge.sends >= MAX_SENDS)
      throw new HttpException(
        {
          code: 'LOGIN_CODE_TOO_MANY_SENDS',
          message: 'No more codes for this sign-in. Sign in again.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const wait = Math.ceil(
      RESEND_GAP_SECONDS - (Date.now() - challenge.lastSentAt.getTime()) / 1000,
    );
    if (wait > 0)
      throw new HttpException(
        {
          code: 'LOGIN_CODE_WAIT',
          message: `Wait ${wait} seconds before asking for another code.`,
          seconds: wait,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    if (!challenge.user.email) throw this.notSent();
    await this.prisma.loginChallenge.update({
      where: { id: challengeId },
      data: { sends: { increment: 1 }, lastSentAt: new Date() },
    });
    await this.sendCode(
      challengeId,
      challenge.user.email,
      await language(challenge.user.id),
    );
    return { sentTo: maskEmail(challenge.user.email) };
  }

  private async sendCode(
    challengeId: string,
    email: string,
    language: Language,
  ) {
    const code = newCode();
    await this.prisma.loginChallenge.update({
      where: { id: challengeId },
      data: { codeHash: hashCode(this.secret, challengeId, code) },
    });
    if (!this.mailer.enabled) {
      if (this.production) throw this.notSent();
      // Local development without SMTP: the code goes to the server log only.
      this.logger.warn(
        `Sign-in code for ${email}: ${code} (SMTP not set; development only)`,
      );
      return;
    }
    const { subject, body } = codeEmail(language, code);
    if (!(await this.mailer.send(email, subject, body))) throw this.notSent();
  }

  private notSent() {
    return new ServiceUnavailableException({
      code: 'LOGIN_CODE_NOT_SENT',
      message:
        'The sign-in code could not be emailed. Try again in a few minutes.',
    });
  }

  // ── The school's switch (Settings → Sign-in security) ──

  async setting(tenantId: string) {
    const school = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { loginCodes: true },
    });
    const covered = await this.prisma.user.count({
      where: {
        tenantId,
        passwordHash: { not: null },
        role: { not: Role.parent },
      },
    });
    return {
      enabled: school.loginCodes,
      mailReady: this.mailer.enabled || !this.production,
      covered,
    };
  }

  async setEnabled(tenantId: string, enabled: boolean) {
    // Never switch it on when no code could be delivered: everyone would be locked out.
    if (enabled && !this.mailer.enabled && this.production)
      throw new ServiceUnavailableException({
        code: 'LOGIN_CODE_MAIL_OFF',
        message:
          'Email is not set up on the server, so sign-in codes cannot be sent yet.',
      });
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { loginCodes: enabled },
    });
    return this.setting(tenantId);
  }
}
