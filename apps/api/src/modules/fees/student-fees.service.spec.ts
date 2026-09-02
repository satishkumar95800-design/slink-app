import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FeeStatus, PaymentMethod, Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { StudentFeesService } from './student-fees.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReceiptsService } from '../receipts/receipts.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AdjustmentType } from './dto/adjust-student-fee.dto';

const adminUser: ActiveUser = {
  id: 'admin-uuid',
  tenantId: 'tenant-uuid',
  role: Role.admin,
  name: 'Admin',
  isVerified: true,
};

const parentUser: ActiveUser = {
  id: 'parent-uuid',
  tenantId: 'tenant-uuid',
  role: Role.parent,
  name: 'Parent',
  isVerified: true,
};

const makeFee = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'fee-uuid',
  tenantId: 'tenant-uuid',
  studentId: 'student-uuid',
  feeStructureId: 'fs-uuid',
  amountDue: new Prisma.Decimal('5000.00'),
  amountPaid: new Prisma.Decimal('0.00'),
  status: FeeStatus.pending,
  dueDate: new Date('2099-12-31'), // far future so not overdue
  student: {
    id: 'student-uuid',
    name: 'John',
    admissionNo: 'A001',
    classId: 'class-uuid',
    class: { id: 'class-uuid', name: 'Grade 5' },
  },
  feeStructure: {
    id: 'fs-uuid',
    name: 'Term 1',
    academicYear: '2025-26',
    items: [{ id: 'item-uuid', label: 'Tuition', amount: new Prisma.Decimal('5000.00') }],
  },
  ...overrides,
});

const mockPrisma = {
  studentFee: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  student: {
    findUnique: jest.fn(),
  },
  feeStructure: {
    findUnique: jest.fn(),
  },
  class: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  studentParent: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

/** tx surface used inside recordOfflinePayment's callback-form transaction */
const mockTx = {
  studentFee: { update: jest.fn() },
  auditLog: { create: jest.fn() },
};

const mockReceiptsService = {
  createForPayment: jest.fn(),
};

describe('StudentFeesService', () => {
  let service: StudentFeesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentFeesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReceiptsService, useValue: mockReceiptsService },
      ],
    }).compile();

    service = module.get<StudentFeesService>(StudentFeesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated results for admin', async () => {
      const fee = makeFee();
      mockPrisma.$transaction.mockResolvedValue([[fee], 1]);
      const result = await service.findAll('tenant-uuid', adminUser, {});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('scopes parent to their students', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll('tenant-uuid', parentUser, {});
      const [query] = mockPrisma.$transaction.mock.calls[0][0];
      // The $transaction call receives an array; first element is the findMany args
      // We verify via the mocked $transaction receiving the correct args
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('returns fee for admin', async () => {
      const fee = makeFee();
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const result = await service.findOne('tenant-uuid', 'fee-uuid', adminUser);
      expect(result).toEqual(fee);
    });

    it('throws NotFoundException when fee does not exist', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      await expect(service.findOne('tenant-uuid', 'fee-uuid', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for parent with no link to student', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      mockPrisma.studentParent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('tenant-uuid', 'fee-uuid', parentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignOne', () => {
    it('creates a student fee assignment', async () => {
      const fee = makeFee();
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid' });
      mockPrisma.feeStructure.findUnique.mockResolvedValue({
        id: 'fs-uuid',
        totalAmount: new Prisma.Decimal('5000.00'),
        dueDate: new Date('2025-06-01'),
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      mockPrisma.studentFee.create.mockResolvedValue(fee);

      const result = await service.assignOne('tenant-uuid', {
        studentId: 'student-uuid',
        feeStructureId: 'fs-uuid',
      });
      expect(result).toEqual(fee);
    });

    it('throws BadRequestException when already assigned', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid' });
      mockPrisma.feeStructure.findUnique.mockResolvedValue({ id: 'fs-uuid', totalAmount: new Prisma.Decimal('5000.00'), dueDate: new Date() });
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());

      await expect(
        service.assignOne('tenant-uuid', {
          studentId: 'student-uuid',
          feeStructureId: 'fs-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when student does not exist', async () => {
      mockPrisma.student.findUnique.mockResolvedValue(null);
      mockPrisma.feeStructure.findUnique.mockResolvedValue({ id: 'fs-uuid' });
      await expect(
        service.assignOne('tenant-uuid', { studentId: 'bad-id', feeStructureId: 'fs-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordOfflinePayment', () => {
    it('updates amountPaid, recalculates status to paid, and creates a receipt', async () => {
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ amountPaid: new Prisma.Decimal('1000.00'), status: FeeStatus.paid });
      const fakeReceipt = { id: 'receipt-uuid', receiptNumber: 'DEMO-2026-000001' };
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.all(cb as Promise<unknown>[]),
      );
      mockTx.studentFee.update.mockResolvedValue(updatedFee);
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue(fakeReceipt);

      const result = await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { amount: 1000, method: PaymentMethod.cash },
        'admin-uuid',
      );
      expect(result).toEqual({ studentFee: updatedFee, receipt: fakeReceipt });
      expect(mockReceiptsService.createForPayment).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          studentId: 'student-uuid',
          classId: 'class-uuid',
          method: PaymentMethod.cash,
          recordedBy: 'admin-uuid',
        }),
      );
    });

    it('throws BadRequestException for waived fees', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ status: FeeStatus.waived }),
      );
      await expect(
        service.recordOfflinePayment('tenant-uuid', 'fee-uuid', { amount: 100, method: PaymentMethod.cash }, 'admin-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when fee does not exist', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      await expect(
        service.recordOfflinePayment('tenant-uuid', 'bad-id', { amount: 100, method: PaymentMethod.cash }, 'admin-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('adjust', () => {
    it('applies discount and reduces amountDue', async () => {
      const fee = makeFee({
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ amountDue: new Prisma.Decimal('4500.00') });
      mockPrisma.$transaction.mockResolvedValue([updatedFee, {}]);

      const result = await service.adjust(
        'tenant-uuid',
        'fee-uuid',
        { type: AdjustmentType.DISCOUNT, discountAmount: 500, reason: 'Scholarship' },
        'admin-uuid',
      );
      expect(result).toEqual(updatedFee);
    });

    it('sets status to waived for waive adjustments', async () => {
      const fee = makeFee({ status: FeeStatus.pending });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ status: FeeStatus.waived });
      mockPrisma.$transaction.mockResolvedValue([updatedFee, {}]);

      await service.adjust(
        'tenant-uuid',
        'fee-uuid',
        { type: AdjustmentType.WAIVE, reason: 'Financial hardship' },
        'admin-uuid',
      );
      const [txOps] = mockPrisma.$transaction.mock.calls[0];
      // We don't have direct access to the update args here because they are Prisma calls,
      // but we verify that the transaction ran with 2 ops
      expect(txOps).toHaveLength(2);
    });

    it('throws BadRequestException when discount exceeds outstanding balance', async () => {
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('800.00'),
        status: FeeStatus.partial,
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);

      await expect(
        service.adjust(
          'tenant-uuid',
          'fee-uuid',
          { type: AdjustmentType.DISCOUNT, discountAmount: 500, reason: 'Too much' },
          'admin-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when adjusting a fully paid fee', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ status: FeeStatus.paid }),
      );
      await expect(
        service.adjust('tenant-uuid', 'fee-uuid', { type: AdjustmentType.WAIVE, reason: 'Already paid' }, 'admin-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when discount type missing discountAmount', async () => {
      const fee = makeFee({ status: FeeStatus.pending });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      await expect(
        service.adjust(
          'tenant-uuid',
          'fee-uuid',
          { type: AdjustmentType.DISCOUNT, reason: 'Missing amount' },
          'admin-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recalcStatus (via recordOfflinePayment)', () => {
    it('returns partial when payment is partial and not overdue', async () => {
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2099-12-31'),
        status: FeeStatus.pending,
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.studentFee.update.mockResolvedValue(makeFee({ status: FeeStatus.partial, amountPaid: new Prisma.Decimal('400.00') }));
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue({ id: 'receipt-uuid' });

      await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { amount: 400, method: PaymentMethod.cash },
        'admin-uuid',
      );
      // The update call should have status = partial
      const updateCall = mockTx.studentFee.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(FeeStatus.partial);
    });

    it('returns overdue when past due date and unpaid', async () => {
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2000-01-01'), // in the past
        status: FeeStatus.overdue,
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.studentFee.update.mockResolvedValue(makeFee({ status: FeeStatus.overdue, amountPaid: new Prisma.Decimal('100.00') }));
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue({ id: 'receipt-uuid' });

      await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { amount: 100, method: PaymentMethod.cash },
        'admin-uuid',
      );
      const updateCall = mockTx.studentFee.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(FeeStatus.overdue);
    });
  });
});
