import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * Plain SMTP via the school's own mailbox (e.g. Hostinger email) — no paid
 * email service. Disabled, and silently skipped, until SMTP_* env vars are set.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string | undefined;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const port = Number(config.get<string>('SMTP_PORT') ?? 465);
    this.from = config.get<string>('SMTP_FROM') ?? user;
    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
            connectionTimeout: 10_000,
          })
        : null;
  }

  get enabled() {
    return this.transporter !== null;
  }

  /** Returns true when sent. Never throws — a failed email must not lose the submission. */
  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (err) {
      this.logger.warn(`Email to ${to} failed: ${(err as Error).message}`);
      return false;
    }
  }
}
