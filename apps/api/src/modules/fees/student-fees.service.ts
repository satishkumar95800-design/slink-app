import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role, FeeStatus, DiscountKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AssignStudentFeeDto } from './dto/assign-student-fee.dto';
import { RecordOfflinePaymentDto } from './dto/record-offline-payment.dto';
import { AdjustStudentFeeDto, AdjustmentType } from './dto/adjust-student-fee.dto';
import { StudentFeeQueryDto } from './dto/student-fee-query.dto';
import { ReceiptsService } from '../receipts/receipts.service';
import { buildStudentFeeComponents, sumComponentAmounts } from './fee-assignment.util';
import { applyDiscountsToComponents } from '../discounts/discount-application.util';
import type { ApplicableStudentDiscount } from '../discounts/discount-application.util';

const studentFeeInclude = {
  student: {
    select: {
      id: true,
      name: true,
      admissionNo: true,
      class: { select: { id: true, name: true } },
    },
  },
  feeStructure: {
    select: {
      id: true,
      name: true,
      academicYear: true,
      items: { select: { id: true, label: true, amount: true } },
    },
  },
  components: {
    include: { feeItem: { select: { id: true, label: true } } },
    orderBy: { periodStart: 'asc' as const },
  },
} satisfies Prisma.StudentFeeInclude;

@Injectable()
export class StudentFeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  async findAll(tenantId: string, user: ActiveUser, query: StudentFeeQueryDto) {
    const where = await this.buildListWhere(tenantId, user, query);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.studentFee.findMany({
        where,
        include: studentFeeInclude,
        orderBy: { dueDate: 'asc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.studentFee.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  async getOutstanding(tenantId: string, user: ActiveUser, query: StudentFeeQueryDto) {
    const base = await this.buildListWhere(tenantId, user, query);
    const where: Prisma.StudentFeeWhereInput = {
      ...base,
      status: { notIn: [FeeStatus.paid, FeeStatus.waived] },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.studentFee.findMany({
        where,
        include: studentFeeInclude,
        orderBy: { dueDate: 'asc' },
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.studentFee.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: query.limit ?? 20 };
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id, tenantId },
      include: studentFeeInclude,
    });

    if (!fee) throw new NotFoundException('Student fee not found');
    await this.assertAccess(tenantId, fee, user);
    return fee;
  }

  async assignOne(tenantId: string, dto: AssignStudentFeeDto) {
    const [student, structure] = await Promise.all([
      this.prisma.student.findUnique({
        where: { id: dto.studentId, tenantId },
        include: { transportSlab: { select: { monthlyAmount: true } } },
      }),
      this.prisma.feeStructure.findUnique({
        where: { id: dto.feeStructureId, tenantId },
        include: { items: true },
      }),
    ]);

    if (!student) throw new NotFoundException('Student not found');
    if (!structure) throw new NotFoundException('Fee structure not found');

    const existing = await this.prisma.studentFee.findUnique({
      where: { studentId_feeStructureId: { studentId: dto.studentId, feeStructureId: dto.feeStructureId } },
    });
    if (existing) {
      throw new BadRequestException('Student is already assigned to this fee structure');
    }

    const discounts = await this.loadDiscounts(tenantId, dto.studentId);
    const components = buildStudentFeeComponents(
      structure,
      discounts,
      student.transportSlab?.monthlyAmount,
    );
    const amountDue = dto.amountDueOverride
      ? new Prisma.Decimal(dto.amountDueOverride.toFixed(2))
      : sumComponentAmounts(components);

    return this.prisma.studentFee.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        feeStructureId: dto.feeStructureId,
        amountDue,
        dueDate: dto.dueDateOverride ? new Date(dto.dueDateOverride) : structure.dueDate,
        components: { create: components },
      },
      include: studentFeeInclude,
    });
  }

  /**
   * Records a cash/cheque/bank-transfer/demand-draft payment that may cover
   * multiple fee components in one transaction (e.g. "Tuition & Van Fee").
   */
  async recordOfflinePayment(
    tenantId: string,
    id: string,
    dto: RecordOfflinePaymentDto,
    actorId: string,
  ) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id, tenantId },
      include: {
        student: { select: { id: true, classId: true } },
        components: { include: { feeItem: { select: { label: true } } } },
      },
    });
    if (!fee) throw new NotFoundException('Student fee not found');

    if (fee.status === FeeStatus.waived) {
      throw new BadRequestException('Cannot record payment for a waived fee');
    }

    const componentsById = new Map(fee.components.map((c) => [c.id, c]));
    const componentUpdates: Array<{
      id: string;
      amount: Prisma.Decimal;
      newAmountPaid: Prisma.Decimal;
      newStatus: FeeStatus;
    }> = [];
    const labels = new Set<string>();
    let totalIncoming = new Prisma.Decimal(0);

    for (const alloc of dto.allocations) {
      const component = componentsById.get(alloc.studentFeeComponentId);
      if (!component) {
        throw new BadRequestException(
          `Component ${alloc.studentFeeComponentId} does not belong to this fee`,
        );
      }
      const allocAmount = new Prisma.Decimal(alloc.amount.toFixed(2));
      const newAmountPaid = component.amountPaid.add(allocAmount);
      if (newAmountPaid.greaterThan(component.amountDue)) {
        throw new BadRequestException(
          `Allocation for "${component.feeItem.label} (${component.periodLabel})" exceeds its outstanding amount`,
        );
      }
      componentUpdates.push({
        id: component.id,
        amount: allocAmount,
        newAmountPaid,
        newStatus: this.recalcStatus(component.amountDue, newAmountPaid, component.dueDate),
      });
      labels.add(component.feeItem.label);
      totalIncoming = totalIncoming.add(allocAmount);
    }

    const newAmountPaid = fee.amountPaid.add(totalIncoming);
    const newStatus = this.recalcStatus(fee.amountDue, newAmountPaid, fee.dueDate);
    const paidOn = dto.paidOn ? new Date(dto.paidOn) : new Date();
    const autoNotes = [...labels].join(' & ');

    // Callback-form transaction (not the array form used elsewhere in this file) —
    // receipt-number generation needs to read the incremented tenant sequence
    // before inserting the Receipt row, which the array form can't express.
    const [studentFee, receipt] = await this.prisma.$transaction(async (tx) => {
      for (const u of componentUpdates) {
        await tx.studentFeeComponent.update({
          where: { id: u.id },
          data: { amountPaid: u.newAmountPaid, status: u.newStatus },
        });
      }

      const updated = await tx.studentFee.update({
        where: { id },
        data: { amountPaid: newAmountPaid, status: newStatus },
        include: studentFeeInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId,
          entityType: 'StudentFee',
          entityId: id,
          action: 'offline_payment',
          diff: {
            amount: totalIncoming.toFixed(2),
            method: dto.method,
            reference: dto.reference ?? null,
            paidOn: paidOn.toISOString(),
            notes: dto.notes ?? null,
            allocations: dto.allocations.map((a) => ({
              studentFeeComponentId: a.studentFeeComponentId,
              amount: a.amount,
            })),
            previousAmountPaid: fee.amountPaid.toFixed(2),
            newAmountPaid: newAmountPaid.toFixed(2),
            newStatus,
          },
        },
      });

      const createdReceipt = await this.receiptsService.createForPayment(tx, {
        tenantId,
        studentFeeId: id,
        studentId: fee.student.id,
        classId: fee.student.classId,
        amount: totalIncoming,
        method: dto.method,
        reference: dto.reference,
        paidOn,
        notes: dto.notes ?? autoNotes,
        recordedBy: actorId,
      });

      for (const u of componentUpdates) {
        await tx.receiptAllocation.create({
          data: { receiptId: createdReceipt.id, studentFeeComponentId: u.id, amount: u.amount },
        });
      }

      return [updated, createdReceipt] as const;
    });

    return { studentFee, receipt };
  }

  async adjust(
    tenantId: string,
    id: string,
    dto: AdjustStudentFeeDto,
    actorId: string,
  ) {
    const fee = await this.prisma.studentFee.findUnique({
      where: { id, tenantId },
      include: { components: true },
    });
    if (!fee) throw new NotFoundException('Student fee not found');

    if (fee.status === FeeStatus.paid) {
      throw new BadRequestException('Cannot adjust a fully paid fee');
    }

    const targets = dto.studentFeeComponentId
      ? fee.components.filter((c) => c.id === dto.studentFeeComponentId)
      : fee.components;
    if (dto.studentFeeComponentId && targets.length === 0) {
      throw new NotFoundException('Fee component not found');
    }

    // Represent each target's outstanding balance in the same shape the
    // discount-application util works with, so waive/discount can reuse it.
    const outstanding = targets.map((c) => ({
      feeItemId: c.feeItemId,
      periodLabel: c.periodLabel,
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      dueDate: c.dueDate,
      amountDue: c.amountDue.sub(c.amountPaid),
      __componentId: c.id,
    }));
    const totalOutstanding = outstanding.reduce((sum, c) => sum.add(c.amountDue), new Prisma.Decimal(0));

    let reduced: typeof outstanding;
    if (dto.type === AdjustmentType.WAIVE) {
      reduced = outstanding.map((c) => ({ ...c, amountDue: new Prisma.Decimal(0) }));
    } else {
      if (!dto.discountAmount) {
        throw new BadRequestException('discountAmount is required for discount adjustments');
      }
      const discount = new Prisma.Decimal(dto.discountAmount.toFixed(2));
      if (discount.greaterThan(totalOutstanding)) {
        throw new BadRequestException('Discount cannot exceed the outstanding balance');
      }
      const applied: ApplicableStudentDiscount = {
        kind: DiscountKind.fixed_amount,
        feeItemId: null,
        percentage: null,
        fixedAmount: discount,
      };
      reduced = applyDiscountsToComponents(outstanding, [applied]);
    }

    const reducedById = new Map(reduced.map((c) => [c.__componentId, c.amountDue]));
    const componentUpdates = fee.components.map((c) => {
      const remaining = reducedById.get(c.id) ?? c.amountDue.sub(c.amountPaid);
      const newAmountDue = c.amountPaid.add(remaining);
      return {
        id: c.id,
        newAmountDue,
        newStatus: this.recalcStatus(newAmountDue, c.amountPaid, c.dueDate),
      };
    });

    const newAmountDue = componentUpdates.reduce((sum, c) => sum.add(c.newAmountDue), new Prisma.Decimal(0));
    const newStatus = this.recalcStatus(newAmountDue, fee.amountPaid, fee.dueDate);
    const auditAction: string = dto.type;

    const [updated] = await this.prisma.$transaction([
      this.prisma.studentFee.update({
        where: { id },
        data: { amountDue: newAmountDue, status: newStatus },
        include: studentFeeInclude,
      }),
      ...componentUpdates.map((c) =>
        this.prisma.studentFeeComponent.update({
          where: { id: c.id },
          data: { amountDue: c.newAmountDue, status: c.newStatus },
        }),
      ),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          entityType: 'StudentFee',
          entityId: id,
          action: auditAction,
          diff: {
            type: dto.type,
            studentFeeComponentId: dto.studentFeeComponentId ?? null,
            discountAmount: dto.discountAmount ?? null,
            reason: dto.reason,
            previousAmountDue: fee.amountDue.toFixed(2),
            newAmountDue: newAmountDue.toFixed(2),
            previousStatus: fee.status,
            newStatus,
          },
        },
      }),
    ]);

    return updated;
  }

  private recalcStatus(
    amountDue: Prisma.Decimal,
    amountPaid: Prisma.Decimal,
    dueDate: Date,
  ): FeeStatus {
    if (amountPaid.greaterThanOrEqualTo(amountDue)) return FeeStatus.paid;
    const now = new Date();
    if (dueDate < now) return FeeStatus.overdue;
    if (amountPaid.greaterThan(0)) return FeeStatus.partial;
    return FeeStatus.pending;
  }

  private async loadDiscounts(tenantId: string, studentId: string): Promise<ApplicableStudentDiscount[]> {
    const discounts = await this.prisma.studentDiscount.findMany({
      where: { tenantId, studentId },
      include: { discountType: { select: { kind: true } } },
    });
    return discounts.map((d) => ({
      kind: d.discountType.kind,
      feeItemId: d.feeItemId,
      percentage: d.percentage,
      fixedAmount: d.fixedAmount,
    }));
  }

  private async buildListWhere(
    tenantId: string,
    user: ActiveUser,
    query: StudentFeeQueryDto,
  ): Promise<Prisma.StudentFeeWhereInput> {
    const where: Prisma.StudentFeeWhereInput = { tenantId };

    if (query.status) where.status = query.status;
    if (query.dueBefore) where.dueDate = { lte: new Date(query.dueBefore) };

    if (user.role === Role.parent) {
      where.student = {
        parents: { some: { parentId: user.id } },
      };
      if (query.studentId) {
        where.studentId = query.studentId;
      }
    } else if (user.role === Role.teacher) {
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teachers: { some: { teacherId: user.id } } },
        select: { id: true },
      });
      where.student = { classId: { in: teacherClasses.map((c) => c.id) } };
      if (query.studentId) where.studentId = query.studentId;
      if (query.classId) where.student = { classId: query.classId };
    } else {
      if (query.studentId) where.studentId = query.studentId;
      if (query.classId) where.student = { classId: query.classId };
    }

    if (query.academicYear) {
      where.feeStructure = { academicYear: query.academicYear };
    }

    return where;
  }

  private async assertAccess(
    tenantId: string,
    fee: { studentId: string; student: { class: { id: string } | null } | null },
    user: ActiveUser,
  ) {
    if (user.role === Role.parent) {
      const link = await this.prisma.studentParent.findUnique({
        where: { studentId_parentId: { studentId: fee.studentId, parentId: user.id } },
      });
      if (!link) throw new NotFoundException('Student fee not found');
    } else if (user.role === Role.teacher) {
      const classId = (fee.student as any)?.class?.id;
      if (!classId) throw new NotFoundException('Student fee not found');
      const cls = await this.prisma.class.findUnique({
        where: { id: classId, tenantId },
        select: { teachers: { select: { teacherId: true } } },
      });
      if (!cls?.teachers.some((t) => t.teacherId === user.id)) {
        throw new NotFoundException('Student fee not found');
      }
    }
  }
}
