import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import { FileCategory } from './dto/upload-file.dto';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}));

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const TENANT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('fake-pdf'),
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  };
}

describe('FilesService', () => {
  let service: FilesService;
  let mockSend: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const cfg: Record<string, string> = {
                S3_BUCKET_NAME: 'slink-assets',
                AWS_REGION: 'ap-south-1',
                S3_ENDPOINT: 'http://localhost:4566',
              };
              return cfg[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    mockSend = (S3Client as jest.Mock).mock.results[0]?.value?.send as jest.Mock;
    jest.clearAllMocks();

    // Re-bind send mock after clearAllMocks
    mockSend = jest.fn().mockResolvedValue({});
    (service as any).s3 = { send: mockSend };
    (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.example.com/signed-url');
  });

  // ── upload ────────────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('uploads a PDF report and returns private key', async () => {
      const file = makeFile();
      const result = await service.upload(TENANT_ID, file, FileCategory.REPORT_PDF, 'report-uuid');

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.key).toMatch(new RegExp(`^private/${TENANT_ID}/reports/report-uuid/`));
      expect(result.key).toMatch(/\.pdf$/);
      expect(result.publicUrl).toBeNull();
      expect(result.contentType).toBe('application/pdf');
    });

    it('uploads a logo and returns a public URL', async () => {
      const file = makeFile({ mimetype: 'image/png', originalname: 'logo.png', size: 512 });
      const result = await service.upload(TENANT_ID, file, FileCategory.LOGO);

      expect(result.key).toMatch(new RegExp(`^public/${TENANT_ID}/logos/`));
      expect(result.key).toMatch(/\.png$/);
      expect(result.publicUrl).toContain('slink-assets');
    });

    it('throws BadRequestException for disallowed MIME type', async () => {
      const file = makeFile({ mimetype: 'video/mp4', originalname: 'video.mp4' });
      await expect(
        service.upload(TENANT_ID, file, FileCategory.REPORT_PDF),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds size limit', async () => {
      const file = makeFile({ size: 25 * 1024 * 1024 }); // 25 MB — over 20 MB PDF limit
      await expect(
        service.upload(TENANT_ID, file, FileCategory.REPORT_PDF),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for logo exceeding 5 MB', async () => {
      const file = makeFile({ mimetype: 'image/jpeg', originalname: 'big.jpg', size: 6 * 1024 * 1024 });
      await expect(
        service.upload(TENANT_ID, file, FileCategory.LOGO),
      ).rejects.toThrow(BadRequestException);
    });

    it('infers extension from MIME when originalname has none', async () => {
      const file = makeFile({ originalname: 'document', mimetype: 'application/pdf' });
      const result = await service.upload(TENANT_ID, file, FileCategory.REPORT_PDF);
      expect(result.key).toMatch(/\.pdf$/);
    });

    it('uploads an attachment with entityId in key path', async () => {
      const file = makeFile({ mimetype: 'image/jpeg', originalname: 'photo.jpg', size: 100 });
      const result = await service.upload(TENANT_ID, file, FileCategory.ATTACHMENT, 'entity-uuid');
      expect(result.key).toContain('entity-uuid');
    });
  });

  // ── getSignedUrl ──────────────────────────────────────────────────────────────

  describe('getSignedUrl', () => {
    it('returns presigned URL for a private key owned by the tenant', async () => {
      mockSend.mockResolvedValue({}); // HeadObject succeeds
      const key = `private/${TENANT_ID}/reports/r1/abc.pdf`;
      const url = await service.getSignedUrl(key, TENANT_ID);
      expect(url).toBe('https://s3.example.com/signed-url');
    });

    it('returns direct public URL for a public key without signing', async () => {
      const key = `public/${TENANT_ID}/logos/abc.png`;
      const url = await service.getSignedUrl(key, TENANT_ID);
      expect(url).toContain('slink-assets');
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when key belongs to a different tenant', async () => {
      const key = `private/other-tenant-id/reports/r1/abc.pdf`;
      await expect(service.getSignedUrl(key, TENANT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when S3 HeadObject fails (file does not exist)', async () => {
      mockSend.mockRejectedValueOnce(new Error('NoSuchKey'));
      const key = `private/${TENANT_ID}/reports/r1/missing.pdf`;
      await expect(service.getSignedUrl(key, TENANT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('deletes an object owned by the tenant', async () => {
      const key = `private/${TENANT_ID}/reports/r1/abc.pdf`;
      await service.delete(key, TENANT_ID);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('throws ForbiddenException when key belongs to a different tenant', async () => {
      const key = `private/other-tenant/reports/r1/abc.pdf`;
      await expect(service.delete(key, TENANT_ID)).rejects.toThrow(ForbiddenException);
    });
  });
});
