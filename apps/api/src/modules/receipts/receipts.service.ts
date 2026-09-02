import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';

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
}

export interface ReceiptListQuery {
  studentId?: string;
  classId?: string;
  method?: PaymentMethod;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

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
        select: { teacherId: true },
      });
      if (cls?.teacherId !== user.id) {
        throw new ForbiddenException('This receipt is not for a student in your class');
      }
    }

    return receipt;
  }

  async findAll(tenantId: string, user: ActiveUser, query: ReceiptListQuery) {
    const where: Prisma.ReceiptWhereInput = { tenantId };

    if (query.studentId) where.studentId = query.studentId;
    if (query.classId) where.classId = query.classId;
    if (query.method) where.method = query.method;
    if (query.dateFrom || query.dateTo) {
      where.paidOn = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    if (user.role === Role.teacher) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teacherId: user.id },
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
