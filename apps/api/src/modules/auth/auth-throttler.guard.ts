import { Injectable } from '@nestjs/common';
import { PublicThrottlerGuard } from '../public-site/public-throttler.guard';

/**
 * Sign-in limits counted per account (the email or phone in the body), so
 * guessing one account's password is capped however many addresses the
 * guesses come from; X-Forwarded-For can be set by the caller, so an IP alone
 * is no limit. Requests without either fall back to the IP.
 */
@Injectable()
export class AuthThrottlerGuard extends PublicThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const account = [body.email, body.phone].find(
      (v): v is string => typeof v === 'string' && v.trim() !== '',
    );
    if (account) return Promise.resolve(`acct:${account.trim().toLowerCase()}`);
    return super.getTracker(req);
  }
}
