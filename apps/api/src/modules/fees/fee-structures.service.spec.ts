import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { FeeStructuresService } from './fee-structures.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  classId: 'class-uuid',
  academicYear: '2025-26',
  dueDate: new Date('2025-06-01'),
  lateFeePerDay: 0,
  totalAmount: { toFixed: () => '5000.00', add: jest.fn(), sub: jest.fn(), greaterThan: jest.fn() },
  class: { id: 'class-uuid', name: 'Grade 5', academicYear: '2025-26' },
  items: [{ id: 'item-uuid', label: 'Tuition', amount: '5000.00' }],
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
  },
  student: {
    findMany: jest.fn(),
  },
};

describe('FeeStructuresService', () => {
  let service: FeeStructuresService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeStructuresService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FeeStructuresService>(FeeStructuresService);
    jest.clearAllMocks();
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
      await service.findAll('tenant-uuid', adminUser, { classId: 'class-uuid' });
      const call = mockPrisma.feeStructure.findMany.mock.calls[0][0];
      expect(call.where.classId).toBe('class-uuid');
    });

    it('scopes teacher to their class(es)', async () => {
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'class-uuid' }]);
      mockPrisma.feeStructure.findMany.mockResolvedValue([mockFeeStructure]);
      await service.findAll('tenant-uuid', teacherUser, {});
      const call = mockPrisma.feeStructure.findMany.mock.calls[0][0];
      expect(call.where.classId).toEqual({ in: ['class-uuid'] });
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
      await expect(service.findOne('tenant-uuid', 'fs-uuid', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for teacher accessing another class', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.class.findUnique.mockResolvedValue({ teacherId: 'other-teacher-uuid' });
      await expect(service.findOne('tenant-uuid', 'fs-uuid', teacherUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows teacher to access their own class structure', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.class.findUnique.mockResolvedValue({ teacherId: teacherUser.id });
      const result = await service.findOne('tenant-uuid', 'fs-uuid', teacherUser);
      expect(result).toEqual(mockFeeStructure);
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Term 1 Fees',
      classId: 'class-uuid',
      academicYear: '2025-26',
      dueDate: '2025-06-01',
      items: [{ label: 'Tuition', amount: 5000 }],
    };

    it('creates a fee structure with correct totalAmount', async () => {
      mockPrisma.class.findUnique.mockResolvedValue({ id: 'class-uuid' });
      mockPrisma.feeStructure.create.mockResolvedValue(mockFeeStructure);

      await service.create('tenant-uuid', createDto);

      const call = mockPrisma.feeStructure.create.mock.calls[0][0];
      expect(call.data.totalAmount.toFixed(2)).toBe('5000.00');
    });

    it('throws NotFoundException when classId does not exist', async () => {
      mockPrisma.class.findUnique.mockResolvedValue(null);
      await expect(service.create('tenant-uuid', createDto)).rejects.toThrow(NotFoundException);
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
          { label: 'Tuition', amount: 3000 },
          { label: 'Activity', amount: 1000 },
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
      await expect(service.remove('tenant-uuid', 'fs-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('assignToClass', () => {
    it('assigns all students and returns correct summary', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.student.findMany.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
      ]);
      mockPrisma.studentFee.findMany.mockResolvedValue([{ studentId: 's1' }]);
      mockPrisma.studentFee.createMany.mockResolvedValue({ count: 2 });

      const result = await service.assignToClass('tenant-uuid', 'fs-uuid', {});
      expect(result).toEqual({ total: 3, assigned: 2, skipped: 1 });
      expect(mockPrisma.studentFee.createMany).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when class has no students', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.student.findMany.mockResolvedValue([]);
      await expect(service.assignToClass('tenant-uuid', 'fs-uuid', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('skips createMany when all students already assigned', async () => {
      mockPrisma.feeStructure.findUnique.mockResolvedValue(mockFeeStructure);
      mockPrisma.student.findMany.mockResolvedValue([{ id: 's1' }]);
      mockPrisma.studentFee.findMany.mockResolvedValue([{ studentId: 's1' }]);

      const result = await service.assignToClass('tenant-uuid', 'fs-uuid', {});
      expect(result).toEqual({ total: 1, assigned: 0, skipped: 1 });
      expect(mockPrisma.studentFee.createMany).not.toHaveBeenCalled();
    });
  });
});
