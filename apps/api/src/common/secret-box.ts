import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * AES-256-GCM for values stored at rest (HR identifiers, bank details).
 * Same scheme and key as the payment-gateway secrets (PAYMENT_SECRETS_KEY, any
 * string of 32+ characters hashed to 32 bytes): "v1:<iv>:<tag>:<ciphertext>", base64.
 */
const VERSION = 'v1';

export class SecretKeyMissingError extends Error {
  constructor() {
    super('PAYMENT_SECRETS_KEY (32+ characters) is not set');
  }
}

function keyFrom(raw: string | undefined): Buffer {
  if (!raw || raw.length < 32) throw new SecretKeyMissingError();
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(
  rawKey: string | undefined,
  plain: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(rawKey), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    data.toString('base64'),
  ].join(':');
}

export function decryptSecret(
  rawKey: string | undefined,
  stored: string,
): string {
  const [version, iv, tag, data] = stored.split(':');
  if (version !== VERSION || !iv || !tag || !data)
    throw new Error('Unknown secret format');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFrom(rawKey),
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Keeps the last [visible] characters: "ABCDE1234F" -> "XXXXXX234F". Short values are fully masked. */
export function maskValue(value: string, visible = 4): string {
  const v = value.trim();
  if (v.length <= visible) return 'X'.repeat(Math.max(v.length, 4));
  return 'X'.repeat(v.length - visible) + v.slice(-visible);
}
