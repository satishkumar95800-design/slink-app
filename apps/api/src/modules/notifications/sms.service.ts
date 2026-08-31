import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly client: Twilio | null;
  private readonly from: string;
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {
    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN');
    this.from = config.get<string>('TWILIO_PHONE_NUMBER') ?? '';

    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    } else {
      this.client = null;
      this.logger.warn(
        'Twilio credentials not configured — SMS will be no-ops in dev mode',
      );
    }
  }

  async send(
    to: string,
    body: string,
  ): Promise<{ sid: string | null; error: string | null }> {
    if (!this.client) {
      this.logger.warn(`SMS (dev no-op) to ${to}: ${body}`);
      return { sid: null, error: null };
    }

    try {
      const message = await this.client.messages.create({
        to,
        from: this.from,
        body,
      });
      return { sid: message.sid, error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMS failed to ${to}: ${error}`);
      return { sid: null, error };
    }
  }
}
