import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getApps } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService implements OnModuleInit {
  private messaging: Messaging | null = null;
  private readonly logger = new Logger(FcmService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const apps = getApps();
    if (apps.length > 0 && apps[0]) {
      this.messaging = getMessaging(apps[0]);
    }
    // In dev (no Firebase app initialised), messaging stays null and sends are no-ops
  }

  /**
   * Sends to up to 500 tokens in a single FCM multicast call.
   * Returns the number of successfully delivered messages.
   */
  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{
    successCount: number;
    failureCount: number;
    failedTokens: string[];
  }> {
    if (!tokens.length)
      return { successCount: 0, failureCount: 0, failedTokens: [] };

    if (!this.messaging) {
      this.logger.warn('FCM not initialised (dev mode) — skipping multicast');
      return { successCount: tokens.length, failureCount: 0, failedTokens: [] };
    }

    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const failedTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const response = await this.messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        ...(data ? { data } : {}),
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((r, idx) => {
        if (!r.success) failedTokens.push(batch[idx]);
      });
    }

    this.logger.log(
      `FCM multicast: ${successCount} sent, ${failureCount} failed`,
    );
    return { successCount, failureCount, failedTokens };
  }
}
