import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';

const makeTenant = (overrides: Record<string, unknown> = {}) => ({
  id: 'tenant-uuid',
  slug: 'greenfield-school',
  name: 'Greenfield School',
  logoUrl: null,
  primaryColor: '#1E40AF',
  accentColor: '#F59E0B',
  timezone: 'Asia/Kolkata',
  isActive: true,
  branding: {},
  features: {
    installmentPlans: false,
    inAppMessaging: false,
    transportFeeModule: true,
    photoGallery: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { users: 0, students: 0 },
  ...overrides,
});

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockFiles = {
  getSignedUrl: jest.fn(),
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FilesService, useValue: mockFiles },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { slug: 'greenfield-school', name: 'Greenfield School' };

    it('creates a new tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(makeTenant());

      const result = await service.create(dto);
      expect(result.slug).toBe('greenfield-school');
      expect(mockPrisma.tenant.create).toHaveBeenCalledTimes(1);
    });

    it('applies defaults for timezone and colors', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(makeTenant());

      await service.create(dto);
      const call = mockPrisma.tenant.create.mock.calls[0][0];
      expect(call.data.timezone).toBe('Asia/Kolkata');
      expect(call.data.primaryColor).toBe('#1E40AF');
      expect(call.data.accentColor).toBe('#F59E0B');
    });

    it('throws ConflictException when slug is already taken', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('respects provided timezone and colors', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(makeTenant());

      await service.create({ ...dto, timezone: 'Europe/London', primaryColor: '#FF0000' });
      const call = mockPrisma.tenant.create.mock.calls[0][0];
      expect(call.data.timezone).toBe('Europe/London');
      expect(call.data.primaryColor).toBe('#FF0000');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated tenants', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeTenant()], 1]);
      const result = await service.findAll({});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('filters by isActive', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll({ isActive: false });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('filters by search term', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeTenant()], 1]);
      await service.findAll({ search: 'greenfield' });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns tenant when found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());
      const result = await service.findById('tenant-uuid');
      expect(result.id).toBe('tenant-uuid');
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.findById('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update (super_admin)', () => {
    it('updates allowed fields', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());
      mockPrisma.tenant.findFirst.mockResolvedValue(null); // slug not taken
      mockPrisma.tenant.update.mockResolvedValue(makeTenant({ name: 'New Name' }));

      const result = await service.update('tenant-uuid', { name: 'New Name', slug: 'new-slug' });
      expect(mockPrisma.tenant.update).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when new slug is taken by another tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());
      mockPrisma.tenant.findFirst.mockResolvedValue(makeTenant({ id: 'other-uuid' }));

      await expect(service.update('tenant-uuid', { slug: 'taken-slug' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(makeTenant());
      mockPrisma.tenant.update.mockResolvedValue(makeTenant({ isActive: false }));

      const result = await service.deactivate('tenant-uuid');
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      expect(call.data.isActive).toBe(false);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getSelf ───────────────────────────────────────────────────────────────────

  describe('getSelf', () => {
    it('returns the current tenant', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      const result = await service.getSelf('tenant-uuid');
      expect(result.id).toBe('tenant-uuid');
    });
  });

  // ── updateSelf ────────────────────────────────────────────────────────────────

  describe('updateSelf', () => {
    it('updates name and colors', async () => {
      mockPrisma.tenant.update.mockResolvedValue(makeTenant({ name: 'Updated School' }));

      await service.updateSelf('tenant-uuid', { name: 'Updated School', primaryColor: '#FF0000' });
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      expect(call.data.name).toBe('Updated School');
      expect(call.data.primaryColor).toBe('#FF0000');
    });

    it('resolves logoUrl from S3 key when logoKey is provided', async () => {
      mockFiles.getSignedUrl.mockResolvedValue('https://s3.example.com/public/tenant-uuid/logos/abc.png');
      mockPrisma.tenant.update.mockResolvedValue(makeTenant({ logoUrl: 'https://s3.example.com/public/tenant-uuid/logos/abc.png' }));

      await service.updateSelf('tenant-uuid', { logoKey: 'public/tenant-uuid/logos/abc.png' });
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      expect(call.data.logoUrl).toBe('https://s3.example.com/public/tenant-uuid/logos/abc.png');
    });

    it('merges branding JSON', async () => {
      mockPrisma.tenant.update.mockResolvedValue(makeTenant());

      await service.updateSelf('tenant-uuid', {
        branding: { contactEmail: 'admin@school.com', address: '123 Main St' },
      });
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      expect(call.data.branding).toBeDefined();
    });
  });

  // ── updateFeatures ────────────────────────────────────────────────────────────

  describe('updateFeatures', () => {
    it('merges feature flags with current state', async () => {
      const currentFeatures = {
        installmentPlans: false,
        inAppMessaging: false,
        transportFeeModule: true,
        photoGallery: false,
      };
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({ features: currentFeatures });
      mockPrisma.tenant.update.mockResolvedValue(
        makeTenant({ features: { ...currentFeatures, installmentPlans: true } }),
      );

      const result = await service.updateFeatures('tenant-uuid', { installmentPlans: true });
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      expect(call.data.features).toEqual({
        installmentPlans: true,
        inAppMessaging: false,
        transportFeeModule: true,
        photoGallery: false,
      });
    });

    it('only updates flags that are explicitly provided', async () => {
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue({
        features: { installmentPlans: false, inAppMessaging: false, transportFeeModule: true, photoGallery: false },
      });
      mockPrisma.tenant.update.mockResolvedValue(makeTenant());

      await service.updateFeatures('tenant-uuid', { photoGallery: true });
      const call = mockPrisma.tenant.update.mock.calls[0][0];
      // transportFeeModule should remain true (not overwritten)
      expect(call.data.features.transportFeeModule).toBe(true);
      expect(call.data.features.photoGallery).toBe(true);
    });
  });
});
