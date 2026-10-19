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

const mockRekognitionSend = jest.fn();
jest.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: jest.fn().mockImplementation(() => ({ send: mockRekognitionSend })),
  DetectModerationLabelsCommand: jest.fn().mockImplementation((input) => ({ input })),
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

  // ── photo screening (homework / notice photos) ─────────────────────────────────

  describe('photo screening', () => {
    let screened: FilesService;
    let send: jest.Mock;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          FilesService,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string) =>
                ({ S3_BUCKET_NAME: 'slink-assets', AWS_REGION: 'ap-south-1', IMAGE_MODERATION: 'on' })[key],
            },
          },
        ],
      }).compile();
      screened = module.get(FilesService);
      send = jest.fn().mockResolvedValue({});
      (screened as any).s3 = { send };
      mockRekognitionSend.mockReset();
    });

    const photo = () => makeFile({ mimetype: 'image/jpeg', originalname: 'hw.jpg', size: 2048 });

    it('stores a safe homework photo marked as checked', async () => {
      mockRekognitionSend.mockResolvedValue({ ModerationLabels: [] });
      await screened.upload(TENANT_ID, photo(), FileCategory.ATTACHMENT);
      expect(mockRekognitionSend).toHaveBeenCalledTimes(1);
      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      const put = (PutObjectCommand as jest.Mock).mock.calls.at(-1)[0];
      expect(put.Metadata.moderation).toBe('passed');
    });

    it('refuses an unsafe photo and stores nothing', async () => {
      mockRekognitionSend.mockResolvedValue({
        ModerationLabels: [{ Name: 'Explicit Nudity', ParentName: '', Confidence: 97 }],
      });
      await expect(screened.upload(TENANT_ID, photo(), FileCategory.ATTACHMENT)).rejects.toMatchObject({
        response: { code: 'IMAGE_NOT_ALLOWED' },
      });
      expect(send).not.toHaveBeenCalled();
    });

    it('refuses the upload when the check cannot run', async () => {
      mockRekognitionSend.mockRejectedValue(new Error('AccessDenied'));
      await expect(screened.upload(TENANT_ID, photo(), FileCategory.ATTACHMENT)).rejects.toMatchObject({
        response: { code: 'IMAGE_CHECK_UNAVAILABLE' },
      });
      expect(send).not.toHaveBeenCalled();
    });

    it('refuses a photo over 5 MB, which cannot be checked', async () => {
      const big = makeFile({ mimetype: 'image/png', originalname: 'hw.png', size: 6 * 1024 * 1024 });
      await expect(screened.upload(TENANT_ID, big, FileCategory.ATTACHMENT)).rejects.toMatchObject({
        response: { code: 'IMAGE_TOO_LARGE_TO_CHECK' },
      });
      expect(mockRekognitionSend).not.toHaveBeenCalled();
    });

    it('does not screen PDFs or other categories', async () => {
      await screened.upload(TENANT_ID, makeFile(), FileCategory.ATTACHMENT);
      await screened.upload(TENANT_ID, photo(), FileCategory.STUDENT_PHOTO);
      expect(mockRekognitionSend).not.toHaveBeenCalled();
    });

    it('a broadcast accepts only photos marked as checked', async () => {
      const key = `private/${TENANT_ID}/attachments/a.jpg`;
      send.mockResolvedValueOnce({ Metadata: { moderation: 'passed' } });
      await expect(
        screened.assertImagesChecked([{ key, contentType: 'image/jpeg' }], TENANT_ID),
      ).resolves.toBeUndefined();
      send.mockResolvedValueOnce({ Metadata: {} });
      await expect(
        screened.assertImagesChecked([{ key, contentType: 'image/jpeg' }], TENANT_ID),
      ).rejects.toMatchObject({ response: { code: 'IMAGE_NOT_CHECKED' } });
    });

    it('a broadcast PDF needs no check', async () => {
      await screened.assertImagesChecked(
        [{ key: `private/${TENANT_ID}/attachments/a.pdf`, contentType: 'application/pdf' }],
        TENANT_ID,
      );
      expect(send).not.toHaveBeenCalled();
    });
  });

  it('screening is off with a local S3 endpoint (the default service above)', async () => {
    mockRekognitionSend.mockReset();
    await service.upload(TENANT_ID, makeFile({ mimetype: 'image/jpeg', originalname: 'p.jpg' }), FileCategory.ATTACHMENT);
    await service.assertImagesChecked([{ key: `private/${TENANT_ID}/attachments/a.jpg`, contentType: 'image/jpeg' }], TENANT_ID);
    expect(mockRekognitionSend).not.toHaveBeenCalled();
  });
});
