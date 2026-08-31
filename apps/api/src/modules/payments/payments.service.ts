import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma, Role, FeeStatus, PaymentOrderStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretsService } from '../../secrets/secrets.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

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
    private readonly secrets: SecretsService,
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

    const idempotencyKey =
      dto.idempotencyKey ?? `${tenantId}:${dto.studentFeeId}`;

    // Fetched up front (and 5-minute cached in SecretsService) since the Razorpay
    // publishable key_id is returned to the client either way — new order or replay.
    const { keyId, keySecret } =
      await this.secrets.getRazorpayCredentials(tenantId);

    // Idempotency check: return existing non-failed order for the same key
    const existing = await this.prisma.paymentOrder.findUnique({
      where: { idempotencyKey },
      include: orderInclude,
    });
    if (existing && existing.status !== PaymentOrderStatus.failed) {
      return { ...existing, keyId };
    }

    // Outstanding amount in paise (integer arithmetic, per architectural invariant)
    const outstandingInr = fee.amountDue.sub(fee.amountPaid);
    const amountInPaise = Math.round(outstandingInr.toNumber() * 100);

    if (amountInPaise <= 0) {
      throw new BadRequestException('No outstanding amount to pay');
    }

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
    const { keyId } = await this.secrets.getRazorpayCredentials(tenantId);
    return { ...order, keyId };
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
  ) {
    const fee = await this.prisma.studentFee.findUniqueOrThrow({
      where: { id: order.studentFeeId },
    });

    const newAmountPaid = fee.amountPaid.add(order.amount);
    const newFeeStatus = this.recalcFeeStatus(
      fee.amountDue,
      newAmountPaid,
      fee.dueDate,
    );

    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.paid },
      }),
      this.prisma.paymentTransaction.create({
        data: {
          tenantId: order.tenantId,
          paymentOrderId: order.id,
          gatewayPaymentId,
          gatewaySignature,
          amount: order.amount,
          paidAt,
        },
      }),
      this.prisma.studentFee.update({
        where: { id: order.studentFeeId },
        data: { amountPaid: newAmountPaid, status: newFeeStatus },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId: order.tenantId,
          actorId: order.id, // gateway actor — no human actor for webhooks
          entityType: 'StudentFee',
          entityId: order.studentFeeId,
          action: 'gateway_payment_captured',
          diff: {
            gatewayPaymentId,
            amount: order.amount.toFixed(2),
            previousAmountPaid: fee.amountPaid.toFixed(2),
            newAmountPaid: newAmountPaid.toFixed(2),
            newStatus: newFeeStatus,
          },
        },
      }),
    ]);
  }

  async markOrderFailed(orderId: string) {
    await this.prisma.paymentOrder.update({
      where: { id: orderId },
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
