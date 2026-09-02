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
import {
  FileCategory,
  ALLOWED_MIME,
  MAX_BYTES,
} from './dto/upload-file.dto';

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
  private readonly endpoint: string | undefined;
  private readonly logger = new Logger(FilesService.name);

  constructor(private readonly config: ConfigService) {
    this.endpoint = config.get<string>('S3_ENDPOINT');
    this.bucket = config.get<string>('S3_BUCKET_NAME') ?? 'slink-assets';

    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION') ?? 'ap-south-1',
      ...(this.endpoint ? { endpoint: this.endpoint, forcePathStyle: true } : {}),
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

    this.logger.log(`Uploaded ${key} (${file.size} bytes)`);

    return {
      key,
      publicUrl: isPublic ? this.buildPublicUrl(key) : null,
      size: file.size,
      contentType: file.mimetype,
    };
  }

  async getSignedUrl(key: string, tenantId: string, expiresIn = 900): Promise<string> {
    this.assertTenantOwnsKey(key, tenantId);

    if (key.startsWith('public/')) {
      // Public keys don't need a signed URL — return the direct URL
      return this.buildPublicUrl(key);
    }

    // Verify the object exists before issuing a URL
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      throw new NotFoundException(`File not found: ${key}`);
    }

    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string, tenantId: string): Promise<void> {
    this.assertTenantOwnsKey(key, tenantId);

    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted ${key}`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private validateFile(file: Express.Multer.File, category: FileCategory): void {
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
    const ext = extname(file.originalname).toLowerCase() || this.inferExt(file.mimetype);

    switch (category) {
      case FileCategory.LOGO:
        return `public/${tenantId}/logos/${uuid}${ext}`;
      case FileCategory.REPORT_PDF:
        return `private/${tenantId}/reports/${entityId ?? uuid}/${uuid}${ext}`;
      case FileCategory.ATTACHMENT:
        return `private/${tenantId}/attachments/${entityId ? `${entityId}/` : ''}${uuid}${ext}`;
      case FileCategory.STUDENT_PHOTO:
        return `private/${tenantId}/students/${entityId ?? uuid}/${uuid}${ext}`;
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
    };
    return map[mimeType] ?? '';
  }
}
