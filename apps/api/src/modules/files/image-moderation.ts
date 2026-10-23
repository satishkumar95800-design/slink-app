import { FileCategory } from './dto/upload-file.dto';

/**
 * Photos teachers and admins send to parents (homework and notice
 * attachments) are screened by AWS Rekognition before they are stored. A photo
 * with any unsafe label (explicit or suggestive content, violence, disturbing
 * images, rude gestures, drugs, alcohol, tobacco, gambling, hate symbols) is
 * refused. If the check can't run, the upload is refused too: nothing
 * unchecked reaches parents. The stored object carries `moderation: passed`
 * in its S3 metadata, and a broadcast only accepts photos that carry it.
 *
 * Off when IMAGE_MODERATION=off, and by default with a custom S3 endpoint
 * (LocalStack in local dev, which has no Rekognition).
 */
export const CHECKED_IMAGE_TYPES = ['image/jpeg', 'image/png'];

/** Rekognition's limit for image bytes sent in the request. */
export const MAX_CHECK_BYTES = 5 * 1024 * 1024;

/** Labels below this confidence (0–100) are ignored. */
export const MIN_CONFIDENCE = 60;

/** S3 metadata key (stored as x-amz-meta-moderation). */
export const MODERATION_META = 'moderation';
export const MODERATION_PASSED = 'passed';

export const needsImageCheck = (category: FileCategory, mimetype: string) =>
  (category === FileCategory.ATTACHMENT ||
    category === FileCategory.ALBUM_PHOTO) &&
  CHECKED_IMAGE_TYPES.includes(mimetype);

export function imageModerationEnabled(
  setting: string | undefined,
  s3Endpoint: string | undefined,
): boolean {
  const v = setting?.trim().toLowerCase();
  if (v === 'on' || v === 'true') return true;
  if (v === 'off' || v === 'false') return false;
  return !s3Endpoint;
}

export interface ModerationLabel {
  Name?: string;
  ParentName?: string;
  Confidence?: number;
}

/** The distinct top-level categories found at or above MIN_CONFIDENCE. */
export function blockedCategories(labels: ModerationLabel[]): string[] {
  const found = new Set<string>();
  for (const l of labels) {
    if ((l.Confidence ?? 0) < MIN_CONFIDENCE) continue;
    const top = l.ParentName || l.Name;
    if (top) found.add(top);
  }
  return [...found];
}
