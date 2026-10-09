import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Express } from 'express';
import { FileCategory, ALLOWED_MIME, MAX_BYTES } from './dto/upload-file.dto';

export interface UploadResult {
  key: string;
  /** Direct public URL for public/ objects; null for private objects */
  publicUrl: string | null;
  size: number;
  contentType: string;
}

@Injectable()
export class FilesService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string | undefined;
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('S3_ENDPOINT');
    this.bucket = config.get<string>('S3_BUCKET_NAME') ?? 'slink-assets';
    this.region = config.get<string>('AWS_REGION') ?? 'ap-south-1';

    this.s3 = new S3Client({
      region: this.region,
      ...(this.endpoint
        ? { endpoint: this.endpoint, forcePathStyle: true }
        : {}),
    });
  }

  async upload(
    tenantId: string,
    file: Express.Multer.File,
    category: FileCategory,
    entityId?: string,
  ): Promise<UploadResult> {
    this.validateFile(file, category);

    const key = this.buildKey(tenantId, category, file, entityId);
    const isPublic = key.startsWith('public/');

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
          ...(isPublic ? { ACL: 'public-read' } : {}),
          Metadata: {
            tenantId,
            category,
            ...(entityId ? { entityId } : {}),
          },
        }),
      );
    } catch (err) {
      // Without this, a missing/misconfigured AWS credential or wrong-region
      // client surfaces to the caller as a bare 500 with no clue why — this
      // happened in production when AWS_REGION/AWS_ACCESS_KEY_ID/etc. were
      // never set on the host, and the only log line was the success path.
      this.logger.error(
        `S3 upload failed for key ${key} (bucket ${this.bucket}, region ${this.region})`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }

    this.logger.log(`Uploaded ${key} (${file.size} bytes)`);

    return {
      key,
      publicUrl: isPublic ? this.buildPublicUrl(key) : null,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  /**
   * [verifyExists] does a HEAD request first so a missing file is a clean 404;
   * list endpoints signing many known keys at once pass false to skip that round trip.
   */
  async getSignedUrl(
    key: string,
    tenantId: string,
    expiresIn = 900,
    { verifyExists = true }: { verifyExists?: boolean } = {},
  ): Promise<string> {
    this.assertTenantOwnsKey(key, tenantId);

    if (key.startsWith('public/')) {
      // Public keys don't need a signed URL — return the direct URL
      return this.buildPublicUrl(key);
    }

    // Verify the object exists before issuing a URL
    if (verifyExists) {
      try {
        await this.s3.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
      } catch {
        throw new NotFoundException(`File not found: ${key}`);
      }
    }

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /**
   * Recovers the S3 key from a URL this service issued earlier (signed or
   * public, virtual-hosted or path-style). Used for older rows that stored a
   * time-limited URL instead of the key. Null if it doesn't look like ours.
   */
  keyFromUrl(url: string): string | null {
    try {
      let path = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
      if (path.startsWith(`${this.bucket}/`))
        path = path.slice(this.bucket.length + 1);
      return path.length > 0 ? path : null;
    } catch {
      return null;
    }
  }

  async delete(key: string, tenantId: string): Promise<void> {
    this.assertTenantOwnsKey(key, tenantId);

    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    this.logger.log(`Deleted ${key}`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private validateFile(
    file: Express.Multer.File,
    category: FileCategory,
  ): void {
    const allowed = ALLOWED_MIME[category];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for category "${category}". Allowed: ${allowed.join(', ')}`,
      );
    }

    const maxBytes = MAX_BYTES[category];
    if (file.size > maxBytes) {
      const maxMb = (maxBytes / 1024 / 1024).toFixed(0);
      throw new BadRequestException(
        `File size ${(file.size / 1024 / 1024).toFixed(2)} MB exceeds the ${maxMb} MB limit for category "${category}"`,
      );
    }
  }

  private buildKey(
    tenantId: string,
    category: FileCategory,
    file: Express.Multer.File,
    entityId?: string,
  ): string {
    const uuid = randomUUID();
    const ext =
      extname(file.originalname).toLowerCase() || this.inferExt(file.mimetype);

    switch (category) {
      case FileCategory.LOGO:
        return `public/${tenantId}/logos/${uuid}${ext}`;
      case FileCategory.BACKGROUND:
        return `public/${tenantId}/backgrounds/${uuid}${ext}`;
      case FileCategory.REPORT_PDF:
        return `private/${tenantId}/reports/${entityId ?? uuid}/${uuid}${ext}`;
      case FileCategory.ATTACHMENT:
        return `private/${tenantId}/attachments/${entityId ? `${entityId}/` : ''}${uuid}${ext}`;
      case FileCategory.STUDENT_PHOTO:
        return `private/${tenantId}/students/${entityId ?? uuid}/${uuid}${ext}`;
      case FileCategory.GENERAL_DOCUMENT:
        return `private/${tenantId}/documents/${uuid}${ext}`;
      case FileCategory.PAYMENT_CLAIM_PROOF:
        return `private/${tenantId}/payment-claims/${uuid}${ext}`;
    }
  }

  private buildPublicUrl(key: string): string {
    if (this.endpoint) {
      // LocalStack: http://localhost:4566/slink-assets/<key>
      return `${this.endpoint}/${this.bucket}/${key}`;
    }
    // Production AWS: https://<bucket>.s3.<region>.amazonaws.com/<key>
    const region = this.config.get<string>('AWS_REGION') ?? 'ap-south-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private assertTenantOwnsKey(key: string, tenantId: string): void {
    // Key format: {visibility}/{tenantId}/...
    const parts = key.split('/');
    if (parts.length < 2 || parts[1] !== tenantId) {
      throw new ForbiddenException('Access denied to this file');
    }
  }

  private inferExt(mimeType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
    };
    return map[mimeType] ?? '';
  }
}
