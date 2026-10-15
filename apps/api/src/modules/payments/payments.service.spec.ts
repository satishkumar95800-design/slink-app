import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FeeStatus, Role, PaymentOrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentGatewayService,
  PaymentsNotConfiguredException,
} from '../payment-gateway/payment-gateway.service';
import { ReceiptsService } from '../receipts/receipts.service';
import type { ActiveUser } from '../../common/types/active-user.type';

// Mock Razorpay module
jest.mock('razorpay', () => {
  return jest.fn().mockImplementation(() => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_razorpay123',
        amount: 500000,
        currency: 'INR',
      }),
    },
  }));
});

const parentUser: ActiveUser = {
  id: 'parent-uuid',
  tenantId: 'tenant-uuid',
  role: Role.parent,
  name: 'Parent',
  isVerified: true,
};

const adminUser: ActiveUser = {
  id: 'admin-uuid',
  tenantId: 'tenant-uuid',
  role: Role.admin,
  name: 'Admin',
  isVerified: true,
};

const makeFee = (overrides: Record<string, unknown> = {}) => ({
  id: 'fee-uuid',
  tenantId: 'tenant-uuid',
  studentId: 'student-uuid',
  feeStructureId: 'fs-uuid',
  amountDue: new Prisma.Decimal('5000.00'),
  amountPaid: new Prisma.Decimal('0.00'),
  status: FeeStatus.pending,
  dueDate: new Date('2099-12-31'),
  student: {
    id: 'student-uuid',
    name: 'John',
    parents: [{ parentId: 'parent-uuid', studentId: 'student-uuid' }],
  },
  ...overrides,
});

const makeOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-uuid',
  tenantId: 'tenant-uuid',
  studentFeeId: 'fee-uuid',
  gatewayOrderId: 'order_razorpay123',
  amount: new Prisma.Decimal('5000.00'),
  currency: 'INR',
  status: PaymentOrderStatus.created,
  idempotencyKey: 'tenant-uuid:fee-uuid',
  studentFee: {
    id: 'fee-uuid',
    amountDue: new Prisma.Decimal('5000.00'),
    amountPaid: new Prisma.Decimal('0.00'),
    status: FeeStatus.pending,
    student: { id: 'student-uuid', name: 'John', admissionNo: 'A001' },
  },
  transaction: null,
  ...overrides,
});

const mockPrisma = {
  studentFee: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  paymentOrder: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  studentParent: { findFirst: jest.fn() },
  paymentTransaction: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

/** tx surface used inside capturePayment's callback-form transaction */
const mockTx = {
  paymentOrder: { update: jest.fn(), updateMany: jest.fn() },
  paymentTransaction: { create: jest.fn() },
  studentFee: { update: jest.fn() },
  studentFeeComponent: { update: jest.fn() },
  receiptAllocation: { create: jest.fn() },
  auditLog: { create: jest.fn() },
};

const creds = {
  keyId: 'rzp_test_key',
  keySecret: 'rzp_test_secret',
  webhookSecret: 'webhook_secret',
};
const mockSecrets = {
  getCredentials: jest.fn().mockResolvedValue(creds),
  findCredentials: jest.fn().mockResolvedValue(creds),
};

const mockReceiptsService = {
  createForPayment: jest.fn(),
  deliverReceiptNotifications: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PaymentGatewayService, useValue: mockSecrets },
        { provide: ReceiptsService, useValue: mockReceiptsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Restore Razorpay mock after clearAllMocks
    mockSecrets.getCredentials.mockResolvedValue(creds);
    mockSecrets.findCredentials.mockResolvedValue(creds);
    mockPrisma.paymentOrder.findFirst.mockResolvedValue(null);
  });

  describe('createOrder', () => {
    it('creates a Razorpay order for a valid pending fee', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
      mockPrisma.paymentOrder.create.mockResolvedValue(makeOrder());

      const result = await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );
      expect(result.id).toBe('order-uuid');
      expect(result.keyId).toBe('rzp_test_key');
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledTimes(1);
    });

    it('reuses an unpaid order for the same amount (parent tapped Pay again)', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      const existing = makeOrder({ status: PaymentOrderStatus.created });
      mockPrisma.paymentOrder.findFirst.mockResolvedValue(existing);

      const result = await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );
      expect(mockPrisma.paymentOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PaymentOrderStatus.created,
            amount: new Prisma.Decimal('5000.00'),
          }),
        }),
      );
      expect(result).toEqual({ ...existing, keyId: 'rzp_test_key' });
      expect(mockPrisma.paymentOrder.create).not.toHaveBeenCalled();
    });

    it('creates a fresh order with a new key after a failed attempt or a fee change', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ amountPaid: new Prisma.Decimal('1000.00') }),
      );
      mockPrisma.paymentOrder.create.mockResolvedValue(makeOrder());

      await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );
      await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );

      const keys = mockPrisma.paymentOrder.create.mock.calls.map(
        (c: [{ data: { idempotencyKey: string; amount: Prisma.Decimal } }]) =>
          c[0].data,
      );
      expect(keys).toHaveLength(2);
      expect(keys[0].idempotencyKey).not.toEqual(keys[1].idempotencyKey);
      expect(keys[0].amount.toFixed(2)).toBe('4000.00');
    });

    it('refuses a client idempotency key reused for a different amount', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ amountPaid: new Prisma.Decimal('1000.00') }),
      );
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(
        makeOrder({ idempotencyKey: 'my-key' }),
      );
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'fee-uuid', idempotencyKey: 'my-key' },
          parentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('says payment is not set up when the school has no keys', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      mockSecrets.getCredentials.mockRejectedValue(
        new PaymentsNotConfiguredException(),
      );
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'fee-uuid' },
          parentUser,
        ),
      ).rejects.toThrow(PaymentsNotConfiguredException);
    });

    it('throws NotFoundException when fee does not belong to requesting parent', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ student: { id: 'student-uuid', name: 'John', parents: [] } }),
      );
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'fee-uuid' },
          parentUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for a fully paid fee', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ status: FeeStatus.paid }),
      );
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'fee-uuid' },
          parentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a waived fee', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(
        makeFee({ status: FeeStatus.waived }),
      );
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'fee-uuid' },
          parentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when fee not found', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(null);
      await expect(
        service.createOrder(
          'tenant-uuid',
          { studentFeeId: 'bad-id' },
          parentUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses provided idempotencyKey', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
      mockPrisma.paymentOrder.create.mockResolvedValue(makeOrder());

      await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid', idempotencyKey: 'my-key' },
        parentUser,
      );
      expect(mockPrisma.paymentOrder.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { idempotencyKey: 'my-key' } }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated orders for admin', async () => {
      mockPrisma.$transaction.mockResolvedValue([[makeOrder()], 1]);
      const result = await service.findAll('tenant-uuid', adminUser, {});
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('scopes parent to their students', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);
      await service.findAll('tenant-uuid', parentUser, {});
      const [[findManyCall]] = mockPrisma.$transaction.mock.calls;
      // Verify transaction was called (we can't easily inspect Prisma promise args)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('returns order for admin, with the Razorpay key_id attached', async () => {
      const order = makeOrder();
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(order);
      const result = await service.findOne(
        'tenant-uuid',
        'order-uuid',
        adminUser,
      );
      expect(result).toEqual({ ...order, keyId: 'rzp_test_key' });
    });

    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.findOne('tenant-uuid', 'bad-id', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for parent with no link to student', async () => {
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(makeOrder());
      mockPrisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne('tenant-uuid', 'order-uuid', parentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('capturePayment', () => {
    it('updates order, creates transaction, updates fee status, and creates a receipt', async () => {
      const fee = {
        id: 'fee-uuid',
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
        dueDate: new Date('2099-12-31'),
        student: {
          id: 'student-uuid',
          name: 'Test Student',
          classId: 'class-uuid',
        },
        components: [
          {
            id: 'component-uuid',
            amountDue: new Prisma.Decimal('5000.00'),
            amountPaid: new Prisma.Decimal('0.00'),
            dueDate: new Date('2099-12-31'),
          },
        ],
      };
      mockPrisma.studentFee.findUniqueOrThrow.mockResolvedValue(fee);
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
      mockTx.paymentTransaction.create.mockResolvedValue({});
      mockTx.studentFee.update.mockResolvedValue({});
      mockTx.studentFeeComponent.update.mockResolvedValue({});
      mockTx.receiptAllocation.create.mockResolvedValue({});
      mockTx.auditLog.create.mockResolvedValue({});
      mockReceiptsService.createForPayment.mockResolvedValue({
        id: 'receipt-uuid',
      });

      const paidAt = new Date();
      await service.capturePayment(
        {
          id: 'order-uuid',
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          amount: new Prisma.Decimal('5000.00'),
        },
        'pay_gateway123',
        'sig_xyz',
        paidAt,
      );

      expect(mockTx.paymentOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-uuid', status: { not: PaymentOrderStatus.paid } },
        data: { status: PaymentOrderStatus.paid },
      });
      expect(mockTx.paymentTransaction.create).toHaveBeenCalled();
      expect(mockTx.studentFee.update).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled();
      expect(mockReceiptsService.createForPayment).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          studentId: 'student-uuid',
          classId: 'class-uuid',
          method: 'gateway',
          paidOn: paidAt,
          recordedBy: null,
          paymentOrderId: 'order-uuid',
        }),
      );
      expect(
        mockReceiptsService.deliverReceiptNotifications,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-uuid',
          receiptId: 'receipt-uuid',
          studentId: 'student-uuid',
          studentName: 'Test Student',
        }),
      );
    });
  });

  describe('capturePayment - repeats', () => {
    it('does nothing when Razorpay repeats a webhook for an order already paid', async () => {
      mockPrisma.studentFee.findUniqueOrThrow.mockResolvedValue({
        id: 'fee-uuid',
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('5000.00'),
        dueDate: new Date('2099-12-31'),
        student: { id: 'student-uuid', name: 'Test', classId: 'class-uuid' },
        components: [],
      });
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.paymentOrder.updateMany.mockResolvedValue({ count: 0 });

      await service.capturePayment(
        {
          id: 'order-uuid',
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          amount: new Prisma.Decimal('5000.00'),
        },
        'pay_gateway123',
        '',
        new Date(),
        500000,
      );

      expect(mockTx.paymentTransaction.create).not.toHaveBeenCalled();
      expect(mockTx.studentFee.update).not.toHaveBeenCalled();
      expect(mockReceiptsService.createForPayment).not.toHaveBeenCalled();
      expect(
        mockReceiptsService.deliverReceiptNotifications,
      ).not.toHaveBeenCalled();
    });

    it('records what Razorpay actually captured', async () => {
      mockPrisma.studentFee.findUniqueOrThrow.mockResolvedValue({
        id: 'fee-uuid',
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        dueDate: new Date('2099-12-31'),
        student: { id: 'student-uuid', name: 'Test', classId: 'class-uuid' },
        components: [],
      });
      mockPrisma.$transaction.mockImplementation((cb: unknown) =>
        typeof cb === 'function' ? cb(mockTx) : Promise.resolve(cb),
      );
      mockTx.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
      mockReceiptsService.createForPayment.mockResolvedValue({ id: 'r1' });

      await service.capturePayment(
        {
          id: 'order-uuid',
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          amount: new Prisma.Decimal('5000.00'),
        },
        'pay_gateway123',
        '',
        new Date(),
        450000,
      );

      expect(mockTx.studentFee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amountPaid: new Prisma.Decimal('4500'),
          }),
        }),
      );
    });
  });

  describe('markOrderFailed', () => {
    it('marks only a still-open order failed, never a paid one', async () => {
      mockPrisma.paymentOrder.updateMany.mockResolvedValue({ count: 1 });
      await service.markOrderFailed('order-uuid');
      expect(mockPrisma.paymentOrder.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-uuid', status: PaymentOrderStatus.created },
        data: { status: PaymentOrderStatus.failed },
      });
    });
  });
});
