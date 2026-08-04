import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: Record<string, string>;
  expiresAt: number;
}

@Injectable()
export class SecretsService {
  private readonly client: SecretsManagerClient;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(SecretsService.name);

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT'); // LocalStack uses same endpoint
    this.client = new SecretsManagerClient({
      region: config.get<string>('AWS_REGION') ?? 'ap-south-1',
      ...(endpoint ? { endpoint } : {}),
    });
  }

  async getSecret(secretId: string): Promise<Record<string, string>> {
    const cached = this.cache.get(secretId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    this.logger.debug(`Fetching secret: ${secretId}`);
    const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));

    if (!response.SecretString) {
      throw new Error(`Secret ${secretId} has no string value`);
    }

    const value = JSON.parse(response.SecretString) as Record<string, string>;
    this.cache.set(secretId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  /** Returns Razorpay credentials for a tenant from Secrets Manager. */
  async getRazorpayCredentials(tenantId: string): Promise<{
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  }> {
    const secret = await this.getSecret(`slink/tenants/${tenantId}/gateway`);
    return {
      keyId: secret['key_id'],
      keySecret: secret['key_secret'],
      webhookSecret: secret['webhook_secret'],
    };
  }
}
