import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FeeStatus, PaymentMethod, Role, BillingFrequency } from '@prisma/client';
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

const makeComponent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'component-uuid',
  studentFeeId: 'fee-uuid',
  feeItemId: 'item-uuid',
  periodLabel: 'Full Year',
  periodStart: new Date('2025-06-01'),
  periodEnd: new Date('2026-05-31'),
  dueDate: new Date('2099-12-31'),
  amountDue: new Prisma.Decimal('5000.00'),
  amountPaid: new Prisma.Decimal('0.00'),
  status: FeeStatus.pending,
  feeItem: { id: 'item-uuid', label: 'Tuition' },
  ...overrides,
});

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
  components: [makeComponent()],
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
  studentFeeComponent: {
    update: jest.fn(),
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
  studentDiscount: {
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

/** tx surface used inside recordOfflinePayment's callback-form transaction */
const mockTx = {
  studentFee: { update: jest.fn() },
  studentFeeComponent: { update: jest.fn() },
  receiptAllocation: { create: jest.fn() },
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
    mockTx.receiptAllocation.create.mockResolvedValue({});
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
    const structure = {
      id: 'fs-uuid',
      academicYear: '2025-26',
      dueDate: new Date('2025-06-01'),
      items: [
        {
          id: 'item-uuid',
          amount: new Prisma.Decimal('5000.00'),
          billingFrequency: BillingFrequency.one_time,
          quarterMonthCounts: [],
          isTransportFee: false,
        },
      ],
    };

    beforeEach(() => {
      mockPrisma.studentDiscount.findMany.mockResolvedValue([]);
    });

    it('creates a student fee assignment', async () => {
      const fee = makeFee();
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid', transportSlab: null });
      mockPrisma.feeStructure.findUnique.mockResolvedValue(structure);
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      mockPrisma.studentFee.create.mockResolvedValue(fee);

      const result = await service.assignOne('tenant-uuid', {
        studentId: 'student-uuid',
        feeStructureId: 'fs-uuid',
      });
      expect(result).toEqual(fee);
      const call = mockPrisma.studentFee.create.mock.calls[0][0];
      expect(call.data.amountDue.toFixed(2)).toBe('5000.00');
      expect(call.data.components.create).toHaveLength(1);
    });

    it('throws BadRequestException when already assigned', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-uuid', transportSlab: null });
      mockPrisma.feeStructure.findUnique.mockResolvedValue(structure);
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
      mockPrisma.feeStructure.findUnique.mockResolvedValue(structure);
      await expect(
        service.assignOne('tenant-uuid', { studentId: 'bad-id', feeStructureId: 'fs-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordOfflinePayment', () => {
    it('updates amountPaid, recalculates status to paid, and creates a receipt', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
      });
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
        components: [component],
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ amountPaid: new Prisma.Decimal('1000.00'), status: FeeStatus.paid });
      const fakeReceipt = { id: 'receipt-uuid', receiptNumber: 'DEMO-2026-000001' };
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.all(cb as Promise<unknown>[]),
      );
      mockTx.studentFee.update.mockResolvedValue(updatedFee);
      mockTx.studentFeeComponent.update.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue(fakeReceipt);

      const result = await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 1000 }], method: PaymentMethod.cash },
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
      expect(mockTx.receiptAllocation.create).toHaveBeenCalledWith({
        data: { receiptId: 'receipt-uuid', studentFeeComponentId: 'component-uuid', amount: expect.any(Object) },
      });
    });

    it('throws BadRequestException for waived fees', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ status: FeeStatus.waived }),
      );
      await expect(
        service.recordOfflinePayment(
          'tenant-uuid',
          'fee-uuid',
          { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 100 }], method: PaymentMethod.cash },
          'admin-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when fee does not exist', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      await expect(
        service.recordOfflinePayment(
          'tenant-uuid',
          'bad-id',
          { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 100 }], method: PaymentMethod.cash },
          'admin-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when an allocation targets a component not on this fee', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      await expect(
        service.recordOfflinePayment(
          'tenant-uuid',
          'fee-uuid',
          { allocations: [{ studentFeeComponentId: 'not-a-real-component', amount: 100 }], method: PaymentMethod.cash },
          'admin-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when an allocation exceeds the component outstanding amount', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('100.00'),
        amountPaid: new Prisma.Decimal('0.00'),
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee({ components: [component] }));
      await expect(
        service.recordOfflinePayment(
          'tenant-uuid',
          'fee-uuid',
          { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 500 }], method: PaymentMethod.cash },
          'admin-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adjust', () => {
    it('applies discount and reduces amountDue', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
      });
      const fee = makeFee({
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
        components: [component],
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ amountDue: new Prisma.Decimal('4500.00') });
      mockPrisma.$transaction.mockResolvedValue([updatedFee, {}, {}]);

      const result = await service.adjust(
        'tenant-uuid',
        'fee-uuid',
        { type: AdjustmentType.DISCOUNT, discountAmount: 500, reason: 'Scholarship' },
        'admin-uuid',
      );
      expect(result).toEqual(updatedFee);
      const [ops] = mockPrisma.$transaction.mock.calls[0];
      expect(ops).toHaveLength(3); // studentFee.update + 1 component.update + auditLog.create
    });

    it('sets amountDue to 0 for waive adjustments', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
      });
      const fee = makeFee({ status: FeeStatus.pending, components: [component] });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      const updatedFee = makeFee({ status: FeeStatus.waived, amountDue: new Prisma.Decimal('0.00') });
      mockPrisma.$transaction.mockResolvedValue([updatedFee, {}, {}]);

      await service.adjust(
        'tenant-uuid',
        'fee-uuid',
        { type: AdjustmentType.WAIVE, reason: 'Financial hardship' },
        'admin-uuid',
      );
      const [txOps] = mockPrisma.$transaction.mock.calls[0];
      expect(txOps).toHaveLength(3);
    });

    it('throws BadRequestException when discount exceeds outstanding balance', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('800.00'),
      });
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('800.00'),
        status: FeeStatus.partial,
        components: [component],
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

    it('throws NotFoundException when studentFeeComponentId does not belong to the fee', async () => {
      const fee = makeFee({ status: FeeStatus.pending });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      await expect(
        service.adjust(
          'tenant-uuid',
          'fee-uuid',
          { type: AdjustmentType.WAIVE, studentFeeComponentId: 'not-a-component', reason: 'x' },
          'admin-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('recalcStatus (via recordOfflinePayment)', () => {
    it('returns partial when payment is partial and not overdue', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2099-12-31'),
      });
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2099-12-31'),
        status: FeeStatus.pending,
        components: [component],
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.studentFee.update.mockResolvedValue(makeFee({ status: FeeStatus.partial, amountPaid: new Prisma.Decimal('400.00') }));
      mockTx.studentFeeComponent.update.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue({ id: 'receipt-uuid' });

      await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 400 }], method: PaymentMethod.cash },
        'admin-uuid',
      );
      const updateCall = mockTx.studentFee.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(FeeStatus.partial);
    });

    it('returns overdue when past due date and unpaid', async () => {
      const component = makeComponent({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2000-01-01'), // in the past
      });
      const fee = makeFee({
        amountDue: new Prisma.Decimal('1000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2000-01-01'),
        status: FeeStatus.overdue,
        components: [component],
      });
      mockPrisma.studentFee.findUnique.mockResolvedValue(fee);
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.studentFee.update.mockResolvedValue(makeFee({ status: FeeStatus.overdue, amountPaid: new Prisma.Decimal('100.00') }));
      mockTx.studentFeeComponent.update.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue({ id: 'receipt-uuid' });

      await service.recordOfflinePayment(
        'tenant-uuid',
        'fee-uuid',
        { allocations: [{ studentFeeComponentId: 'component-uuid', amount: 100 }], method: PaymentMethod.cash },
        'admin-uuid',
      );
      const updateCall = mockTx.studentFee.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(FeeStatus.overdue);
    });
  });
});
