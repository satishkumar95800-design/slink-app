import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Role, BillingFrequency, Prisma } from '@prisma/client';
import { FeeStructuresService } from './fee-structures.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const adminUser: ActiveUser = {
  id: 'admin-uuid',
  tenantId: 'tenant-uuid',
  role: Role.admin,
  name: 'Admin',
  isVerified: true,
};

const teacherUser: ActiveUser = {
  id: 'teacher-uuid',
  tenantId: 'tenant-uuid',
  role: Role.teacher,
  name: 'Teacher',
  isVerified: true,
};

const mockFeeStructure = {
  id: 'fs-uuid',
  tenantId: 'tenant-uuid',
  name: 'Term 1 Fees',
  academicYear: '2025-26',
  dueDate: new Date('2025-06-01'),
  lateFeePerDay: 0,
  totalAmount: {
    toFixed: () => '5000.00',
    add: jest.fn(),
    sub: jest.fn(),
    greaterThan: jest.fn(),
  },
  classes: [
    { class: { id: 'class-uuid', name: 'Grade 5', section: 'A', academicYear: '2025-26', teachers: [{ teacherId: 'teacher-uuid' }] } },
  ],
  items: [{ id: 'item-uuid', label: 'Tuition', amount: '5000.00', billingFrequency: 'one_time', quarterMonthCounts: [], isTransportFee: false }],
  _count: { studentFees: 0 },
};

const mockPrisma = {
  feeStructure: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  class: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  studentFee: {
    count: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
  },
  student: {
    findMany: jest.fn(),
  },
  studentDiscount: {
    findMany: jest.fn(),
  },
};

const mockNotifications = {
  broadcast: jest.fn().mockResolvedValue({ queued: 1 }),
};

describe('FeeStructuresService', () => {
  let service: FeeStructuresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeStructuresService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<FeeStructuresService>(FeeStructuresService);
    jest.clearAllMocks();
    mockNotifications.broadcast.mockResolvedValue({ queued: 1 });
    mockPrisma.studentDiscount.findMany.mockResolvedValue([]);
  });

  describe('findAll', () => {
    it('returns all structures for admin', async () => {
      mockPrisma.feeStructure.findMany.mockResolvedValue([mockFeeStructure]);
      const result = await service.findAll('tenant-uuid', adminUser, {});
      expect(result).toHaveLength(1);
      expect(mockPrisma.feeStructure.findMany).toHaveBeenCalledTimes(1);
    });

    it('filters by classId in query when provided', async () => {
      mockPrisma.feeStructure.findMany.mockResolvedValue([mockFeeStructure]);
      await service.findAll('tenant-uuid', adminUser, {
        classId: 'class-uuid',
      });
      const call = mockPrisma.feeStructure.findMany.mock.calls[0][0];
      expect(call.where.classes).toEqual({ some: { classId: 'class-uuid' } });
    });

    it('scopes teacher to their class(es)', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      mockPrisma.feeStructure.findMany.mockResolvedValue([mockFeeStructure]);
      await service.findAll('tenant-uuid', teacherUser, {});
      const call = mockPrisma.feeStructure.findMany.mock.calls[0][0];
      expect(call.where.classes).toEqual({ some: { classId: { in: ['class-uuid'] } } });
    });
  });

  describe('findOne', () => {
    it('returns structure for admin', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      const result = await service.findOne('tenant-uuid', 'fs-uuid', adminUser);
      expect(result).toEqual(mockFeeStructure);
    });

    it('throws NotFoundException when not found', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(null);
      await expect(
        service.findOne('tenant-uuid', 'fs-uuid', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for teacher not assigned to any linked class', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      await expect(
        service.findOne('tenant-uuid', 'fs-uuid', {
          ...teacherUser,
          id: 'other-teacher-uuid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows teacher to access a structure linked to their class', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      const result = await service.findOne(
        'tenant-uuid',
        'fs-uuid',
        teacherUser,
      );
      expect(result).toEqual(mockFeeStructure);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Term 1 Fees',
      classIds: ['class-uuid'],
      academicYear: '2025-26',
      dueDate: '2025-06-01',
      items: [{ label: 'Tuition', amount: 5000, billingFrequency: BillingFrequency.one_time }],
    };

    it('creates a fee structure with correct totalAmount', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      mockPrisma.feeStructure.create.mockResolvedValue(mockFeeStructure);

      await service.create('tenant-uuid', createDto);

      const call = mockPrisma.feeStructure.create.mock.calls[0][0];
      expect(call.data.totalAmount.toFixed(2)).toBe('5000.00');
      expect(call.data.classes).toEqual({ create: [{ classId: 'class-uuid' }] });
    });

    it('throws NotFoundException when a classId does not exist', async () => {
      mockPrisma.class.findMany.mockResolvedValue([]);
      await expect(service.create('tenant-uuid', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows quarterly quarterMonthCounts that sum to less than 12 (unbilled vacation months)', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      mockPrisma.feeStructure.create.mockResolvedValue(mockFeeStructure);
      // Poorna's real transport quarters: 3,3,2,2 — sums to 10, skipping 2 unbilled months
      await service.create('tenant-uuid', {
        ...createDto,
        items: [
          {
            label: 'Van Fee',
            amount: 4000,
            billingFrequency: BillingFrequency.quarterly,
            quarterMonthCounts: [3, 3, 2, 2],
          },
        ],
      });
      expect(mockPrisma.feeStructure.create).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when quarterly item quarterMonthCounts exceeds 12', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      await expect(
        service.create('tenant-uuid', {
          ...createDto,
          items: [
            {
              label: 'Van Fee',
              amount: 4000,
              billingFrequency: BillingFrequency.quarterly,
              quarterMonthCounts: [8, 8],
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates dueDate when provided', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.feeStructure.update.mockResolvedValue(mockFeeStructure);
      await service.update('tenant-uuid', 'fs-uuid', { dueDate: '2025-07-01' });
      const call = mockPrisma.feeStructure.update.mock.calls[0][0];
      expect(call.data.dueDate).toBeInstanceOf(Date);
    });

    it('recalculates totalAmount when items replaced', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.feeStructure.update.mockResolvedValue(mockFeeStructure);
      await service.update('tenant-uuid', 'fs-uuid', {
        items: [
          { label: 'Tuition', amount: 3000, billingFrequency: BillingFrequency.one_time },
          { label: 'Activity', amount: 1000, billingFrequency: BillingFrequency.one_time },
        ],
      });
      const call = mockPrisma.feeStructure.update.mock.calls[0][0];
      expect(call.data.totalAmount.toFixed(2)).toBe('4000.00');
    });
  });

  describe('remove', () => {
    it('deletes structure when no students assigned', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.studentFee.count.mockResolvedValue(0);
      mockPrisma.feeStructure.delete.mockResolvedValue(mockFeeStructure);
      await service.remove('tenant-uuid', 'fs-uuid');
      expect(mockPrisma.feeStructure.delete).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when students are assigned', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.studentFee.count.mockResolvedValue(5);
      await expect(service.remove('tenant-uuid', 'fs-uuid')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('assignToClass', () => {
    const withItems = {
      ...mockFeeStructure,
      totalAmount: new Prisma.Decimal('5000.00'),
      items: [{ id: 'item-uuid', label: 'Tuition', amount: new Prisma.Decimal('5000.00'), billingFrequency: BillingFrequency.one_time, quarterMonthCounts: [], isTransportFee: false }],
      classes: [{ classId: 'class-uuid' }],
    };

    it('assigns all students and returns correct summary', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(withItems);
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 's1', transportSlab: null },
        { id: 's2', transportSlab: null },
        { id: 's3', transportSlab: null },
      ]);
      mockPrisma.studentFee.findMany.mockResolvedValue([{ studentId: 's1' }]);
      mockPrisma.studentFee.create.mockResolvedValue({});

      const result = await service.assignToClass(
        'tenant-uuid',
        'fs-uuid',
        { classId: 'class-uuid' },
        adminUser,
      );
      expect(result).toEqual({ total: 3, assigned: 2, skipped: 1 });
      expect(mockPrisma.studentFee.create).toHaveBeenCalledTimes(2);
      expect(mockNotifications.broadcast).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the class is not linked to this plan', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(withItems);
      await expect(
        service.assignToClass('tenant-uuid', 'fs-uuid', { classId: 'other-class' }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when class has no students', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(withItems);
      mockPrisma.student.findMany.mockResolvedValue([]);
      await expect(
        service.assignToClass('tenant-uuid', 'fs-uuid', { classId: 'class-uuid' }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('skips creation when all students already assigned', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(withItems);
      mockPrisma.student.findMany.mockResolvedValue([{ id: 's1', transportSlab: null }]);
      mockPrisma.studentFee.findMany.mockResolvedValue([{ studentId: 's1' }]);

      const result = await service.assignToClass(
        'tenant-uuid',
        'fs-uuid',
        { classId: 'class-uuid' },
        adminUser,
      );
      expect(result).toEqual({ total: 1, assigned: 0, skipped: 1 });
      expect(mockPrisma.studentFee.create).not.toHaveBeenCalled();
    });

    it('broadcasts a fee-due notification to the class when notifyParents is true', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(withItems);
      mockPrisma.student.findMany.mockResolvedValue([{ id: 's1', transportSlab: null }]);
      mockPrisma.studentFee.findMany.mockResolvedValue([]);
      mockPrisma.studentFee.create.mockResolvedValue({});

      await service.assignToClass(
        'tenant-uuid',
        'fs-uuid',
        { classId: 'class-uuid', notifyParents: true },
        adminUser,
      );

      expect(mockNotifications.broadcast).toHaveBeenCalledWith(
        'tenant-uuid',
        expect.objectContaining({
          targetType: 'class',
          targetId: 'class-uuid',
        }),
        adminUser,
      );
    });
  });
});
