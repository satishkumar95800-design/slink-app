/** Photo album limits and lifecycle (Premium Max, flag photoAlbums). */

/** Parents can view and save an album's photos this long after it is published. */
export const KEEP_DAYS = 30;
/** One extension by an admin adds this much. */
export const EXTEND_DAYS = 30;
/** Parents who haven't saved yet get one reminder this long before expiry. */
export const REMIND_BEFORE_DAYS = 3;
/** An expired album stays in the parents' list (without photos) this long. */
export const SHOW_EXPIRED_DAYS = 30;
export const MAX_PHOTOS_PER_ALBUM = 100;
/** Bytes of live (not yet expired) albums a school may hold. */
export const SCHOOL_ALLOWANCE_BYTES = 10 * 1024 ** 3;

const DAY_MS = 86_400_000;
export const addDays = (at: Date, days: number) =>
  new Date(at.getTime() + days * DAY_MS);

export type AlbumStatus = 'draft' | 'live' | 'expired';

/** Never stored: draft until published, expired once its time is up. */
export function albumStatus(
  a: {
    publishedAt: Date | null;
    expiresAt: Date | null;
    expiredAt: Date | null;
  },
  now: Date = new Date(),
): AlbumStatus {
  if (!a.publishedAt) return 'draft';
  if (a.expiredAt || (a.expiresAt && a.expiresAt <= now)) return 'expired';
  return 'live';
}

/** Due for the "leaving soon" reminder at [now]. */
export function dueForReminder(
  a: {
    publishedAt: Date | null;
    expiresAt: Date | null;
    expiredAt: Date | null;
    reminderSentAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  return (
    albumStatus(a, now) === 'live' &&
    !a.reminderSentAt &&
    !!a.expiresAt &&
    a.expiresAt.getTime() - now.getTime() <= REMIND_BEFORE_DAYS * DAY_MS
  );
}
