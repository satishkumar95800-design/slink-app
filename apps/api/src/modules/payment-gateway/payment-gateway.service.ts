import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../../prisma/prisma.service';
import { SetPaymentGatewayDto } from './dto/set-payment-gateway.dto';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** Thrown when a school has no Razorpay keys; the app shows "payment is not set up". */
export class PaymentsNotConfiguredException extends BadRequestException {
  constructor() {
    super({
      code: 'PAYMENTS_NOT_CONFIGURED',
      message: 'Online payment is not set up for this school',
    });
  }
}

const VERSION = 'v1';

/**
 * Per-school Razorpay keys, stored in tenant_payment_gateways. key_secret and
 * webhook_secret are AES-256-GCM encrypted with PAYMENT_SECRETS_KEY (any long
 * random string; hashed to a 32-byte key), so a database dump alone can't take
 * payments or forge webhooks.
 */
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** The school's keys, or null when not set up (or unreadable). */
  async findCredentials(tenantId: string): Promise<RazorpayCredentials | null> {
    let row: {
      keyId: string;
      keySecretEnc: string;
      webhookSecretEnc: string;
    } | null;
    try {
      row = await this.prisma.tenantPaymentGateway.findUnique({
        where: { tenantId },
        select: { keyId: true, keySecretEnc: true, webhookSecretEnc: true },
      });
    } catch (err) {
      // e.g. the migration hasn't run yet — treat as "not set up".
      this.logger.error(
        `Could not read payment gateway for ${tenantId}: ${(err as Error).message}`,
      );
      return null;
    }
    if (!row) return null;
    try {
      return {
        keyId: row.keyId,
        keySecret: this.decrypt(row.keySecretEnc),
        webhookSecret: this.decrypt(row.webhookSecretEnc),
      };
    } catch (err) {
      this.logger.error(
        `Could not decrypt payment keys for ${tenantId} (is PAYMENT_SECRETS_KEY right?): ${(err as Error).message}`,
      );
      return null;
    }
  }

  async getCredentials(tenantId: string): Promise<RazorpayCredentials> {
    const creds = await this.findCredentials(tenantId);
    if (!creds) throw new PaymentsNotConfiguredException();
    return creds;
  }

  /** What the platform console shows: never the secrets themselves. */
  async status(tenantId: string) {
    const row = await this.prisma.tenantPaymentGateway.findUnique({
      where: { tenantId },
      select: { keyId: true, updatedAt: true },
    });
    return {
      configured: !!row,
      keyId: row?.keyId ?? null,
      mode: row ? (row.keyId.startsWith('rzp_live_') ? 'live' : 'test') : null,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Saves the keys after Razorpay accepts them. */
  async set(tenantId: string, dto: SetPaymentGatewayDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('School not found');
    this.encryptionKey(); // fail before calling Razorpay if the server isn't set up

    await this.verifyWithRazorpay(dto.keyId, dto.keySecret);

    const data = {
      keyId: dto.keyId,
      keySecretEnc: this.encrypt(dto.keySecret),
      webhookSecretEnc: this.encrypt(dto.webhookSecret),
    };
    await this.prisma.tenantPaymentGateway.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    return this.status(tenantId);
  }

  async remove(tenantId: string) {
    await this.prisma.tenantPaymentGateway.deleteMany({ where: { tenantId } });
    return this.status(tenantId);
  }

  /** A cheap authenticated call, so wrong keys are caught when saved, not when a parent pays. */
  private async verifyWithRazorpay(keyId: string, keySecret: string) {
    try {
      await new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.all({
        count: 1,
      });
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 401) {
        throw new BadRequestException({
          code: 'GATEWAY_KEYS_REJECTED',
          message:
            'Razorpay rejected these keys. Check the Key ID and Key Secret.',
        });
      }
      this.logger.error(`Razorpay key check failed: ${JSON.stringify(err)}`);
      throw new BadRequestException({
        code: 'GATEWAY_UNREACHABLE',
        message:
          'Could not reach Razorpay to check the keys. Try again in a minute.',
      });
    }
  }

  private encryptionKey(): Buffer {
    const raw = this.config.get<string>('PAYMENT_SECRETS_KEY');
    if (!raw || raw.length < 32) {
      throw new BadRequestException({
        code: 'PAYMENT_SECRETS_KEY_MISSING',
        message:
          'The server has no PAYMENT_SECRETS_KEY (32+ characters) set, so keys cannot be stored safely.',
      });
    }
    return createHash('sha256').update(raw).digest();
  }

  /** "v1:<iv>:<tag>:<ciphertext>", all base64. */
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      VERSION,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      data.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, data] = stored.split(':');
    if (version !== VERSION || !iv || !tag || !data)
      throw new Error('Unknown secret format');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
