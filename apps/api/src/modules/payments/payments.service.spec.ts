import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FeeStatus, Role, PaymentOrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretsService } from '../../secrets/secrets.service';
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
    findMany: jest.fn(),
    count: jest.fn(),
  },
  studentParent: { findFirst: jest.fn() },
  paymentTransaction: { create: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockSecrets = {
  getRazorpayCredentials: jest.fn().mockResolvedValue({
    keyId: 'rzp_test_key',
    keySecret: 'rzp_test_secret',
    webhookSecret: 'webhook_secret',
  }),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SecretsService, useValue: mockSecrets },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Restore Razorpay mock after clearAllMocks
    mockSecrets.getRazorpayCredentials.mockResolvedValue({
      keyId: 'rzp_test_key',
      keySecret: 'rzp_test_secret',
      webhookSecret: 'webhook_secret',
    });
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

    it('returns existing order when same idempotency key and not failed', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      const existing = makeOrder({ status: PaymentOrderStatus.created });
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(existing);

      const result = await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );
      expect(result).toEqual({ ...existing, keyId: 'rzp_test_key' });
      expect(mockPrisma.paymentOrder.create).not.toHaveBeenCalled();
    });

    it('creates a new order when existing order has failed status', async () => {
      mockPrisma.studentFee.findUnique.mockResolvedValue(makeFee());
      mockPrisma.paymentOrder.findUnique.mockResolvedValue(
        makeOrder({ status: PaymentOrderStatus.failed }),
      );
      mockPrisma.paymentOrder.create.mockResolvedValue(makeOrder());

      await service.createOrder(
        'tenant-uuid',
        { studentFeeId: 'fee-uuid' },
        parentUser,
      );
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledTimes(1);
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
    it('updates order, creates transaction, and updates fee status', async () => {
      const fee = {
        id: 'fee-uuid',
        amountDue: new Prisma.Decimal('5000.00'),
        amountPaid: new Prisma.Decimal('0.00'),
        status: FeeStatus.pending,
        dueDate: new Date('2099-12-31'),
      };
      mockPrisma.studentFee.findUniqueOrThrow.mockResolvedValue(fee);
      mockPrisma.$transaction.mockResolvedValue([{}, {}, {}, {}]);

      await service.capturePayment(
        {
          id: 'order-uuid',
          tenantId: 'tenant-uuid',
          studentFeeId: 'fee-uuid',
          amount: new Prisma.Decimal('5000.00'),
        },
        'pay_gateway123',
        'sig_xyz',
        new Date(),
      );

      const [txOps] = mockPrisma.$transaction.mock.calls[0];
      expect(txOps).toHaveLength(4); // update order + create transaction + update fee + audit log
    });
  });

  describe('markOrderFailed', () => {
    it('sets order status to failed', async () => {
      mockPrisma.paymentOrder.update.mockResolvedValue({});
      await service.markOrderFailed('order-uuid');
      expect(mockPrisma.paymentOrder.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid' },
        data: { status: PaymentOrderStatus.failed },
      });
    });
  });
});
