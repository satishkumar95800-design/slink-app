import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, Role, FeeStatus, PaymentOrderStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayService } from '../payment-gateway/payment-gateway.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ReceiptsService } from '../receipts/receipts.service';

const orderInclude = {
  studentFee: {
    select: {
      id: true,
      amountDue: true,
      amountPaid: true,
      status: true,
      student: { select: { id: true, name: true, admissionNo: true } },
    },
  },
  transaction: {
    select: {
      id: true,
      gatewayPaymentId: true,
      amount: true,
      paidAt: true,
      receiptUrl: true,
    },
  },
} satisfies Prisma.PaymentOrderInclude;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  async createOrder(tenantId: string, dto: CreateOrderDto, user: ActiveUser) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id: dto.studentFeeId, tenantId },
      include: {
        student: { include: { parents: { where: { parentId: user.id } } } },
      },
    });

    if (!fee) throw new NotFoundException('Student fee not found');

    // Parents can only pay for their own children
    if (user.role === Role.parent && fee.student.parents.length === 0) {
      throw new NotFoundException('Student fee not found');
    }

    if (fee.status === FeeStatus.paid) {
      throw new BadRequestException('This fee is already fully paid');
    }
    if (fee.status === FeeStatus.waived) {
      throw new BadRequestException('This fee has been waived');
    }

    // Outstanding amount in paise (integer arithmetic, per architectural invariant)
    const outstandingInr = fee.amountDue.sub(fee.amountPaid);
    const amountInPaise = Math.round(outstandingInr.toNumber() * 100);

    if (amountInPaise <= 0) {
      throw new BadRequestException('No outstanding amount to pay');
    }

    // The publishable key_id goes back to the client either way — new order or reuse.
    const { keyId, keySecret } = await this.gateway.getCredentials(tenantId);

    // A Razorpay order is fixed to one amount, so only an unpaid, unfailed order
    // for exactly today's outstanding amount is reused (parent closed checkout
    // and tapped Pay again). After a failed attempt or a fee change, a new order.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.paymentOrder.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: orderInclude,
      });
      if (existing) {
        const sameRequest =
          existing.tenantId === tenantId &&
          existing.studentFeeId === dto.studentFeeId;
        const reusable =
          existing.status === PaymentOrderStatus.paid ||
          (existing.status === PaymentOrderStatus.created &&
            existing.amount.equals(outstandingInr));
        if (sameRequest && reusable) return { ...existing, keyId };
        throw new ConflictException(
          'This idempotency key was already used for a different payment',
        );
      }
    } else {
      const reusable = await this.prisma.paymentOrder.findFirst({
        where: {
          tenantId,
          studentFeeId: dto.studentFeeId,
          status: PaymentOrderStatus.created,
          amount: outstandingInr,
        },
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      });
      if (reusable) return { ...reusable, keyId };
    }
    const idempotencyKey =
      dto.idempotencyKey ?? `${tenantId}:${dto.studentFeeId}:${randomUUID()}`;

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const gatewayOrder = await rzp.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `fee_${dto.studentFeeId.replace(/-/g, '').slice(0, 16)}`,
      notes: { tenantId, studentFeeId: dto.studentFeeId, userId: user.id },
    });

    const order = await this.prisma.paymentOrder.create({
      data: {
        tenantId,
        studentFeeId: dto.studentFeeId,
        gatewayOrderId: gatewayOrder.id,
        amount: outstandingInr,
        currency: 'INR',
        idempotencyKey,
      },
      include: orderInclude,
    });

    return { ...order, keyId };
  }

  async findAll(tenantId: string, user: ActiveUser, query: OrderQueryDto) {
    const where: Prisma.PaymentOrderWhereInput = { tenantId };

    if (query.status) where.status = query.status;
    if (query.studentFeeId) where.studentFeeId = query.studentFeeId;

    if (user.role === Role.parent) {
      where.studentFee = {
        student: { parents: { some: { parentId: user.id } } },
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.paymentOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id, tenantId },
      include: orderInclude,
    });

    if (!order) throw new NotFoundException('Payment order not found');

    if (user.role === Role.parent) {
      const link = await this.prisma.studentParent.findFirst({
        where: { studentId: order.studentFee.student.id, parentId: user.id },
      });
      if (!link) throw new NotFoundException('Payment order not found');
    }

    // Included so a client can resume Razorpay Checkout for a still-pending order
    const creds = await this.gateway.findCredentials(tenantId);
    return { ...order, keyId: creds?.keyId ?? null };
  }

  /**
   * Process a captured Razorpay payment: create PaymentTransaction and update StudentFee.
   * Called by WebhookService after HMAC verification.
   */
  async capturePayment(
    order: {
      id: string;
      tenantId: string;
      studentFeeId: string;
      amount: Prisma.Decimal;
    },
    gatewayPaymentId: string,
    gatewaySignature: string,
    paidAt: Date,
    /** What Razorpay says it captured, in paise; defaults to the order amount. */
    capturedPaise?: number,
  ) {
    // What was actually received is what gets recorded. Razorpay captures the
    // order amount, so a difference means something is wrong — log it loudly.
    const received =
      capturedPaise != null
        ? new Prisma.Decimal(capturedPaise).div(100)
        : order.amount;
    if (!received.equals(order.amount)) {
      this.logger.error(
        `Payment ${gatewayPaymentId} captured ${received.toFixed(2)} but order ${order.id} is for ${order.amount.toFixed(2)}`,
      );
    }

    const fee = await this.prisma.studentFee.findUniqueOrThrow({
      where: { id: order.studentFeeId },
      include: {
        student: { select: { id: true, name: true, classId: true } },
        components: { orderBy: { dueDate: 'asc' } },
      },
    });

    const newAmountPaid = fee.amountPaid.add(received);
    const newFeeStatus = this.recalcFeeStatus(
      fee.amountDue,
      newAmountPaid,
      fee.dueDate,
    );

    // A gateway payment doesn't specify which components it covers, so the
    // captured amount is allocated FIFO across the outstanding components
    // ordered by due date.
    let remaining = received;
    const componentAllocations: Array<{
      id: string;
      amount: Prisma.Decimal;
      newAmountPaid: Prisma.Decimal;
      newStatus: FeeStatus;
    }> = [];
    for (const component of fee.components) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const outstanding = component.amountDue.sub(component.amountPaid);
      if (outstanding.lessThanOrEqualTo(0)) continue;
      const allocation = remaining.greaterThan(outstanding)
        ? outstanding
        : remaining;
      const newComponentAmountPaid = component.amountPaid.add(allocation);
      componentAllocations.push({
        id: component.id,
        amount: allocation,
        newAmountPaid: newComponentAmountPaid,
        newStatus: this.recalcFeeStatus(
          component.amountDue,
          newComponentAmountPaid,
          component.dueDate,
        ),
      });
      remaining = remaining.sub(allocation);
    }

    // Callback-form transaction (not the array form used elsewhere in this file) —
    // receipt-number generation needs to read the incremented tenant sequence
    // before inserting the Receipt row, which the array form can't express.
    const receipt = await this.prisma.$transaction(async (tx) => {
      // Razorpay delivers webhooks at least once. Claiming the order inside the
      // transaction (row-locked) makes a repeat — or a concurrent duplicate — a no-op.
      const claimed = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { not: PaymentOrderStatus.paid } },
        data: { status: PaymentOrderStatus.paid },
      });
      if (claimed.count === 0) return null;
      await tx.paymentTransaction.create({
        data: {
          tenantId: order.tenantId,
          paymentOrderId: order.id,
          gatewayPaymentId,
          gatewaySignature,
          amount: received,
          paidAt,
        },
      });
      await tx.studentFee.update({
        where: { id: order.studentFeeId },
        data: { amountPaid: newAmountPaid, status: newFeeStatus },
      });
      for (const alloc of componentAllocations) {
        await tx.studentFeeComponent.update({
          where: { id: alloc.id },
          data: { amountPaid: alloc.newAmountPaid, status: alloc.newStatus },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId: order.tenantId,
          actorId: order.id, // gateway actor — no human actor for webhooks
          entityType: 'StudentFee',
          entityId: order.studentFeeId,
          action: 'gateway_payment_captured',
          diff: {
            gatewayPaymentId,
            amount: received.toFixed(2),
            orderAmount: order.amount.toFixed(2),
            previousAmountPaid: fee.amountPaid.toFixed(2),
            newAmountPaid: newAmountPaid.toFixed(2),
            newStatus: newFeeStatus,
          },
        },
      });
      const createdReceipt = await this.receiptsService.createForPayment(tx, {
        tenantId: order.tenantId,
        studentFeeId: order.studentFeeId,
        studentId: fee.student.id,
        classId: fee.student.classId,
        amount: received,
        method: 'gateway',
        paidOn: paidAt,
        recordedBy: null,
        paymentOrderId: order.id,
      });
      for (const alloc of componentAllocations) {
        await tx.receiptAllocation.create({
          data: {
            receiptId: createdReceipt.id,
            studentFeeComponentId: alloc.id,
            amount: alloc.amount,
          },
        });
      }
      return createdReceipt;
    });

    if (!receipt) {
      this.logger.log(
        `Payment ${gatewayPaymentId} for order ${order.id} was already recorded`,
      );
      return;
    }

    // Addendum 4 / A9 — SMS + push delivery, outside the transaction (see
    // student-fees.service.ts's offline-payment equivalent for the same reasoning).
    await this.receiptsService.deliverReceiptNotifications({
      tenantId: order.tenantId,
      receiptId: receipt.id,
      studentId: fee.student.id,
      studentName: fee.student.name,
      amount: received,
    });
  }

  /**
   * One failed attempt. Razorpay lets the parent retry inside the same checkout,
   * so a later capture still wins: a paid order is never marked failed, and
   * capturePayment accepts a failed one.
   */
  async markOrderFailed(orderId: string) {
    await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: PaymentOrderStatus.created },
      data: { status: PaymentOrderStatus.failed },
    });
  }

  async findOrderByGatewayOrderId(gatewayOrderId: string) {
    return this.prisma.paymentOrder.findFirst({ where: { gatewayOrderId } });
  }

  private recalcFeeStatus(
    amountDue: Prisma.Decimal,
    amountPaid: Prisma.Decimal,
    dueDate: Date,
  ): FeeStatus {
    if (amountPaid.greaterThanOrEqualTo(amountDue)) return FeeStatus.paid;
    if (dueDate < new Date()) return FeeStatus.overdue;
    if (amountPaid.greaterThan(0)) return FeeStatus.partial;
    return FeeStatus.pending;
  }
}
