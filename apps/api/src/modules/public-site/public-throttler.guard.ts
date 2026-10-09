import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limits by the visitor's IP. Behind Hostinger's proxy req.ip is the
 * proxy, so use the first X-Forwarded-For hop when present.
 */
@Injectable()
export class PublicThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    const forwarded = headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    return Promise.resolve(first || (req.ip as string) || 'unknown');
  }
}
