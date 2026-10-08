import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationChannel, PaymentClaimStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentFeesService } from '../fees/student-fees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreatePaymentClaimDto } from './dto/create-payment-claim.dto';
import { ApprovePaymentClaimDto } from './dto/approve-payment-claim.dto';
import { RejectPaymentClaimDto } from './dto/reject-payment-claim.dto';
import { OFFLINE_PAYMENT_METHODS } from '../fees/dto/record-offline-payment.dto';

type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

const claimInclude = {
  student: { select: { id: true, name: true, admissionNo: true } },
  studentFee: { select: { id: true, amountDue: true, amountPaid: true, status: true } },
  submitter: { select: { id: true, name: true, phone: true } },
  reviewer: { select: { id: true, name: true } },
} satisfies Prisma.PaymentClaimInclude;

// A claim's self-reported mode has no direct match for UPI-direct in the
// PaymentMethod enum used by actual recorded payments — closest equivalent.
const CLAIM_MODE_TO_PAYMENT_METHOD: Record<string, OfflinePaymentMethod> = {
  cash: PaymentMethod.cash,
  cheque: PaymentMethod.cheque,
  bank_transfer: PaymentMethod.bank_transfer,
  upi: PaymentMethod.bank_transfer,
};

@Injectable()
export class PaymentClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentFeesService: StudentFeesService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
  ) {}

  /**
   * Addendum 4 / A12 — "Already paid? Upload receipt." studentId is always
   * derived from studentFeeId + the parent's own StudentParent link, never
   * trusted from the request body (parents never query students directly).
   */
  async create(tenantId: string, parentId: string, dto: CreatePaymentClaimDto) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id: dto.studentFeeId, tenantId },
      select: { id: true, studentId: true },
    });
    if (!fee) throw new NotFoundException('Student fee not found');

    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId: fee.studentId, parentId } },
    });
    if (!link) throw new ForbiddenException('You do not have access to this fee');

    return this.prisma.paymentClaim.create({
      data: {
        tenantId,
        studentId: fee.studentId,
        studentFeeId: fee.id,
        submittedBy: parentId,
        fileKey: dto.fileKey,
        claimedAmount: dto.claimedAmount ?? null,
        claimedDate: dto.claimedDate ? new Date(dto.claimedDate) : null,
        claimedMode: dto.claimedMode ?? null,
        note: dto.note ?? null,
      },
      include: claimInclude,
    });
  }

  async findMine(tenantId: string, parentId: string) {
    return this.prisma.paymentClaim.findMany({
      where: { tenantId, submittedBy: parentId },
      include: claimInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Accountant/admin review queue — defaults to the pending backlog. */
  async findAll(tenantId: string, status?: PaymentClaimStatus) {
    return this.prisma.paymentClaim.findMany({
      where: { tenantId, status: status ?? PaymentClaimStatus.pending },
      include: claimInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getProofUrl(tenantId: string, id: string, user: ActiveUser): Promise<{ url: string }> {
    const claim = await this.prisma.paymentClaim.findUnique({ where: { id, tenantId } });
    if (!claim) throw new NotFoundException('Payment claim not found');
    if (user.role === Role.parent && claim.submittedBy !== user.id) {
      throw new ForbiddenException('You do not have access to this claim');
    }
    return { url: await this.files.getSignedUrl(claim.fileKey, tenantId) };
  }

  /**
   * Approve → records the corresponding Transaction (reusing the same
   * offline-payment flow as a manually-recorded cash/bank payment, including
   * its receipt generation and A9 SMS/push delivery) and marks the invoice
   * paid. The claimed amount is a hint, not a guarantee — the approver
   * confirms/corrects it here against the uploaded proof before it's recorded.
   */
  async approve(tenantId: string, id: string, dto: ApprovePaymentClaimDto, actorId: string) {
    const claim = await this.prisma.paymentClaim.findUnique({
      where: { id, tenantId },
      include: {
        student: { select: { id: true, name: true } },
        studentFee: {
          include: {
            components: {
              include: { feeItem: { select: { label: true } } },
              orderBy: { periodStart: 'asc' },
            },
          },
        },
      },
    });
    if (!claim) throw new NotFoundException('Payment claim not found');
    if (claim.status !== PaymentClaimStatus.pending) {
      throw new BadRequestException('This claim has already been reviewed');
    }

    const amountValue = dto.amount ?? (claim.claimedAmount ? Number(claim.claimedAmount) : undefined);
    if (!amountValue || amountValue <= 0) {
      throw new BadRequestException(
        'An amount is required to approve this claim — confirm it against the uploaded proof',
      );
    }
    const amount = new Prisma.Decimal(amountValue.toFixed(2));
    const allocations = this.autoAllocate(claim.studentFee.components, amount);

    const method = claim.claimedMode
      ? CLAIM_MODE_TO_PAYMENT_METHOD[claim.claimedMode]
      : PaymentMethod.bank_transfer;

    const { receipt } = await this.studentFeesService.recordOfflinePayment(
      tenantId,
      claim.studentFeeId,
      {
        method,
        allocations,
        paidOn: claim.claimedDate?.toISOString(),
        notes: `Approved payment claim${claim.note ? `: ${claim.note}` : ''}`,
      },
      actorId,
    );

    const updated = await this.prisma.paymentClaim.update({
      where: { id },
      data: {
        status: PaymentClaimStatus.approved,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        receiptId: receipt.id,
      },
      include: claimInclude,
    });

    await this.notifications.send({
      tenantId,
      userId: claim.submittedBy,
      channel: NotificationChannel.fcm,
      title: 'Payment claim approved',
      body: `Your payment claim for ${claim.student.name} was approved and recorded.`,
      data: {
        type: 'payment_claim',
        claimId: claim.id,
        status: 'approved',
        studentId: claim.studentId,
        studentFeeId: claim.studentFeeId,
      },
    });

    return { claim: updated, receipt };
  }

  async reject(tenantId: string, id: string, dto: RejectPaymentClaimDto, actorId: string) {
    const claim = await this.prisma.paymentClaim.findUnique({
      where: { id, tenantId },
      include: { student: { select: { name: true } } },
    });
    if (!claim) throw new NotFoundException('Payment claim not found');
    if (claim.status !== PaymentClaimStatus.pending) {
      throw new BadRequestException('This claim has already been reviewed');
    }

    const updated = await this.prisma.paymentClaim.update({
      where: { id },
      data: {
        status: PaymentClaimStatus.rejected,
        reviewedBy: actorId,
        reviewedAt: new Date(),
        reviewNote: dto.reviewNote ?? null,
      },
      include: claimInclude,
    });

    await this.notifications.send({
      tenantId,
      userId: claim.submittedBy,
      channel: NotificationChannel.fcm,
      title: 'Payment claim rejected',
      body: dto.reviewNote
        ? `Your payment claim for ${claim.student.name} was rejected: ${dto.reviewNote}`
        : `Your payment claim for ${claim.student.name} was rejected. Please re-check and resubmit.`,
      data: {
        type: 'payment_claim',
        claimId: claim.id,
        status: 'rejected',
        studentId: claim.studentId,
        studentFeeId: claim.studentFeeId,
      },
    });

    return updated;
  }

  /** Fills each outstanding component in period order until the confirmed amount is exhausted. */
  private autoAllocate(
    components: Array<{ id: string; amountDue: Prisma.Decimal; amountPaid: Prisma.Decimal }>,
    amount: Prisma.Decimal,
  ): Array<{ studentFeeComponentId: string; amount: number }> {
    const allocations: Array<{ studentFeeComponentId: string; amount: number }> = [];
    let remaining = amount;

    for (const component of components) {
      if (remaining.lessThanOrEqualTo(0)) break;
      const outstanding = component.amountDue.sub(component.amountPaid);
      if (outstanding.lessThanOrEqualTo(0)) continue;
      const alloc = Prisma.Decimal.min(outstanding, remaining);
      allocations.push({ studentFeeComponentId: component.id, amount: Number(alloc.toFixed(2)) });
      remaining = remaining.sub(alloc);
    }

    if (remaining.greaterThan(0.005)) {
      throw new BadRequestException(
        "The confirmed amount exceeds this fee's outstanding balance — check the uploaded proof and adjust the amount",
      );
    }

    return allocations;
  }
}
