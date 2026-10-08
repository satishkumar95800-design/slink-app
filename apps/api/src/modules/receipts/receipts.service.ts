import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role, PaymentMethod, NotificationChannel } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { formatRupees } from '../../common/format';

/** Marks a signed JWT as a receipt-link token, not a session access token. */
const RECEIPT_LINK_PURPOSE = 'receipt-link';
/** How long the SMS/push receipt link stays valid before the parent must ask
 * the school to re-send it (Addendum 4 / A9 — "signed, time-limited"). */
const RECEIPT_LINK_TTL = '7d';

const receiptInclude = {
  student: {
    select: {
      id: true,
      name: true,
      admissionNo: true,
      parents: { select: { parent: { select: { id: true } } } },
    },
  },
  class: { select: { id: true, name: true, section: true, academicYear: true } },
  studentFee: {
    select: {
      id: true,
      feeStructure: { select: { id: true, name: true, academicYear: true } },
    },
  },
  recordedByUser: { select: { id: true, name: true } },
  discountType: { select: { id: true, name: true, kind: true } },
  tenant: {
    select: { id: true, name: true, logoUrl: true, primaryColor: true, branding: true },
  },
} satisfies Prisma.ReceiptInclude;

export interface CreateReceiptForPaymentParams {
  tenantId: string;
  studentFeeId: string;
  studentId: string;
  classId: string;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  reference?: string | null;
  paidOn: Date;
  notes?: string | null;
  recordedBy?: string | null;
  paymentOrderId?: string | null;
  /** Addendum 4 / A8 — optional discount/concession label. Record-keeping only. */
  discountTypeId?: string | null;
  discountAmount?: Prisma.Decimal | number | null;
  discountNote?: string | null;
}

export interface DeliverReceiptParams {
  tenantId: string;
  receiptId: string;
  studentId: string;
  studentName: string;
  amount: Prisma.Decimal;
}

export interface ReceiptListQuery {
  studentId?: string;
  classId?: string;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  /** Addendum 4 / A8 — optional filter for the "Refunds & Adjustments" / "Fee Collection Summary" reports. */
  discountTypeId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Atomically bumps the tenant's receipt sequence and inserts the Receipt row.
   * Must be called with the `tx` of an in-flight transaction (e.g. from
   * recordOfflinePayment or capturePayment) so the receipt and the payment it
   * documents commit together.
   */
  async createForPayment(tx: Prisma.TransactionClient, params: CreateReceiptForPaymentParams) {
    const tenant = await tx.tenant.update({
      where: { id: params.tenantId },
      data: { receiptSequence: { increment: 1 } },
      select: { receiptSequence: true, slug: true },
    });

    const receiptNumber = `${tenant.slug.toUpperCase()}-${new Date().getFullYear()}-${String(
      tenant.receiptSequence,
    ).padStart(6, '0')}`;

    return tx.receipt.create({
      data: {
        tenantId: params.tenantId,
        receiptNumber,
        studentFeeId: params.studentFeeId,
        studentId: params.studentId,
        classId: params.classId,
        amount: params.amount,
        method: params.method,
        reference: params.reference ?? null,
        paidOn: params.paidOn,
        notes: params.notes ?? null,
        recordedBy: params.recordedBy ?? null,
        paymentOrderId: params.paymentOrderId ?? null,
        discountTypeId: params.discountTypeId ?? null,
        discountAmount: params.discountAmount ?? null,
        discountNote: params.discountNote ?? null,
      },
    });
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id, tenantId },
      include: receiptInclude,
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    if (user.role === Role.parent) {
      const isLinked = receipt.student.parents.some((p) => p.parent.id === user.id);
      if (!isLinked) throw new ForbiddenException('You do not have access to this receipt');
    } else if (user.role === Role.teacher) {
      const cls = await this.prisma.class.findUnique({
        where: { id: receipt.classId },
        select: { teachers: { select: { teacherId: true } } },
      });
      if (!cls?.teachers.some((t) => t.teacherId === user.id)) {
        throw new ForbiddenException('This receipt is not for a student in your class');
      }
    }

    return receipt;
  }

  /**
   * Receipts for one student fee, e.g. mobile's "View Receipt" action from the
   * Fees list — a partially-paid fee can have more than one receipt. Access
   * check mirrors findOne's (parent must be linked to the student; teacher
   * must teach the student's class).
   */
  async findForStudentFee(tenantId: string, studentFeeId: string, user: ActiveUser) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id: studentFeeId, tenantId },
      select: {
        student: {
          select: { classId: true, parents: { select: { parentId: true } } },
        },
      },
    });
    if (!fee) throw new NotFoundException('Student fee not found');

    if (user.role === Role.parent) {
      const isLinked = fee.student.parents.some((p) => p.parentId === user.id);
      if (!isLinked) throw new ForbiddenException('You do not have access to this fee');
    } else if (user.role === Role.teacher) {
      const cls = await this.prisma.class.findUnique({
        where: { id: fee.student.classId },
        select: { teachers: { select: { teacherId: true } } },
      });
      if (!cls?.teachers.some((t) => t.teacherId === user.id)) {
        throw new ForbiddenException('This fee is not for a student in your class');
      }
    }

    return this.prisma.receipt.findMany({
      where: { tenantId, studentFeeId },
      include: receiptInclude,
      orderBy: { paidOn: 'desc' },
    });
  }

  /** Signed, time-limited link a parent can open without logging in — used
   * for the SMS link and as the target of a "receipt ready" push tap. */
  private async signPublicLink(tenantId: string, receiptId: string): Promise<string> {
    const token = await this.jwt.signAsync(
      { receiptId, tenantId, purpose: RECEIPT_LINK_PURPOSE },
      { expiresIn: RECEIPT_LINK_TTL },
    );
    const adminBaseUrl = this.config.get<string>('ADMIN_BASE_URL') ?? 'http://localhost:3001';
    return `${adminBaseUrl}/receipts/public/${token}`;
  }

  /** Authenticated equivalent of signPublicLink — used by the mobile app's
   * in-app "Download" action, gated by findOne's normal role/ownership check. */
  async getDownloadLink(tenantId: string, id: string, user: ActiveUser): Promise<{ url: string }> {
    await this.findOne(tenantId, id, user);
    return { url: await this.signPublicLink(tenantId, id) };
  }

  /** Resolves the unauthenticated public receipt link — the verified token is
   * the only credential, so this never touches @TenantId()/req.user. */
  async findByToken(token: string) {
    let payload: { receiptId: string; tenantId: string; purpose: string };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('This receipt link has expired or is invalid');
    }
    if (payload.purpose !== RECEIPT_LINK_PURPOSE) {
      throw new UnauthorizedException('Invalid receipt link');
    }

    const receipt = await this.prisma.receipt.findUnique({
      where: { id: payload.receiptId, tenantId: payload.tenantId },
      include: receiptInclude,
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  /**
   * Addendum 4 / A9 — SMS + push delivery immediately after a cash receipt is
   * generated, plus the receiptDeliveredAt timestamp for support/troubleshooting.
   * Notification failures are per-recipient (NotificationsService.dispatch
   * already catches and marks them failed) so this never throws back into the
   * payment-recording flow that calls it.
   */
  async deliverReceiptNotifications(params: DeliverReceiptParams): Promise<void> {
    const parents = await this.prisma.studentParent.findMany({
      where: { studentId: params.studentId },
      select: { parent: { select: { id: true } } },
    });
    if (parents.length === 0) return;

    const url = await this.signPublicLink(params.tenantId, params.receiptId);
    const amountLabel = formatRupees(params.amount);
    const smsBody = `Your payment receipt for ${params.studentName} (${amountLabel}) is ready. View/download: ${url}`;

    await Promise.all(
      parents.map((p) =>
        Promise.all([
          this.notifications.send({
            tenantId: params.tenantId,
            userId: p.parent.id,
            channel: NotificationChannel.sms,
            body: smsBody,
          }),
          this.notifications.send({
            tenantId: params.tenantId,
            userId: p.parent.id,
            channel: NotificationChannel.fcm,
            title: 'Payment receipt ready',
            body: `Your payment receipt for ${params.studentName} is ready.`,
            data: { type: 'receipt', receiptId: params.receiptId },
          }),
        ]),
      ),
    );

    await this.prisma.receipt.update({
      where: { id: params.receiptId },
      data: { receiptDeliveredAt: new Date() },
    });
  }

  /**
   * Admin dashboard "Recent Payments" widget — deliberately reuses findAll
   * (method-agnostic across cash/cheque/bank_transfer/gateway, via the
   * `receipts` table) rather than the gateway-only PaymentOrder table the
   * widget used to read from, which silently excluded every offline payment.
   */
  async getRecent(tenantId: string, user: ActiveUser, limit: number) {
    const { data } = await this.findAll(tenantId, user, { limit });
    // Approved payment claims are recorded as ordinary offline receipts; the
    // dashboard badges those "Claim" instead of their underlying method.
    const fromClaims = await this.prisma.paymentClaim.findMany({
      where: { tenantId, receiptId: { in: data.map((r) => r.id) } },
      select: { receiptId: true },
    });
    const claimReceiptIds = new Set(fromClaims.map((c) => c.receiptId));
    return data.map((r) => ({
      id: r.id,
      studentName: r.student.name,
      amount: r.amount,
      method: r.method,
      source: claimReceiptIds.has(r.id) ? ('claim' as const) : ('direct' as const),
      paidOn: r.paidOn,
    }));
  }

  async findAll(tenantId: string, user: ActiveUser, query: ReceiptListQuery) {
    const where: Prisma.ReceiptWhereInput = { tenantId };

    if (query.studentId) where.studentId = query.studentId;
    if (query.classId) where.classId = query.classId;
    if (query.method) where.method = query.method;
    if (query.discountTypeId) where.discountTypeId = query.discountTypeId;
    if (query.dateFrom || query.dateTo) {
      where.paidOn = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    if (user.role === Role.teacher) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teachers: { some: { teacherId: user.id } } },
        select: { id: true },
      });
      const classIds = teacherClasses.map((c) => c.id);
      where.classId = query.classId
        ? classIds.includes(query.classId)
          ? query.classId
          : 'no-match'
        : { in: classIds };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.receipt.findMany({
        where,
        include: receiptInclude,
        orderBy: { paidOn: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
