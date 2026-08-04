import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role, FeeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AssignStudentFeeDto } from './dto/assign-student-fee.dto';
import { RecordOfflinePaymentDto } from './dto/record-offline-payment.dto';
import { AdjustStudentFeeDto, AdjustmentType } from './dto/adjust-student-fee.dto';
import { StudentFeeQueryDto } from './dto/student-fee-query.dto';

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
} satisfies Prisma.StudentFeeInclude;

@Injectable()
export class StudentFeesService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.student.findUnique({ where: { id: dto.studentId, tenantId } }),
      this.prisma.feeStructure.findUnique({ where: { id: dto.feeStructureId, tenantId } }),
    ]);

    if (!student) throw new NotFoundException('Student not found');
    if (!structure) throw new NotFoundException('Fee structure not found');

    const existing = await this.prisma.studentFee.findUnique({
      where: { studentId_feeStructureId: { studentId: dto.studentId, feeStructureId: dto.feeStructureId } },
    });
    if (existing) {
      throw new BadRequestException('Student is already assigned to this fee structure');
    }

    return this.prisma.studentFee.create({
      data: {
        tenantId,
        studentId: dto.studentId,
        feeStructureId: dto.feeStructureId,
        amountDue: dto.amountDueOverride
          ? new Prisma.Decimal(dto.amountDueOverride.toFixed(2))
          : structure.totalAmount,
        dueDate: dto.dueDateOverride ? new Date(dto.dueDateOverride) : structure.dueDate,
      },
      include: studentFeeInclude,
    });
  }

  async recordOfflinePayment(
    tenantId: string,
    id: string,
    dto: RecordOfflinePaymentDto,
    actorId: string,
  ) {
    const fee = await this.prisma.studentFee.findUnique({ where: { id, tenantId } });
    if (!fee) throw new NotFoundException('Student fee not found');

    if (fee.status === FeeStatus.waived) {
      throw new BadRequestException('Cannot record payment for a waived fee');
    }

    const incomingAmount = new Prisma.Decimal(dto.amount.toFixed(2));
    const newAmountPaid = fee.amountPaid.add(incomingAmount);
    const newStatus = this.recalcStatus(fee.amountDue, newAmountPaid, fee.dueDate);

    const [updated] = await this.prisma.$transaction([
      this.prisma.studentFee.update({
        where: { id },
        data: { amountPaid: newAmountPaid, status: newStatus },
        include: studentFeeInclude,
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          entityType: 'StudentFee',
          entityId: id,
          action: 'offline_payment',
          diff: {
            amount: dto.amount,
            method: dto.method,
            reference: dto.reference ?? null,
            paidOn: dto.paidOn ?? new Date().toISOString(),
            notes: dto.notes ?? null,
            previousAmountPaid: fee.amountPaid.toFixed(2),
            newAmountPaid: newAmountPaid.toFixed(2),
            newStatus,
          },
        },
      }),
    ]);

    return updated;
  }

  async adjust(
    tenantId: string,
    id: string,
    dto: AdjustStudentFeeDto,
    actorId: string,
  ) {
    const fee = await this.prisma.studentFee.findUnique({ where: { id, tenantId } });
    if (!fee) throw new NotFoundException('Student fee not found');

    if (fee.status === FeeStatus.paid) {
      throw new BadRequestException('Cannot adjust a fully paid fee');
    }

    let newAmountDue = fee.amountDue;
    let newStatus: FeeStatus;
    const auditAction: string = dto.type;

    if (dto.type === AdjustmentType.WAIVE) {
      newStatus = FeeStatus.waived;
    } else {
      // discount
      if (!dto.discountAmount) {
        throw new BadRequestException('discountAmount is required for discount adjustments');
      }
      const discount = new Prisma.Decimal(dto.discountAmount.toFixed(2));
      if (discount.greaterThan(fee.amountDue.sub(fee.amountPaid))) {
        throw new BadRequestException('Discount cannot exceed the outstanding balance');
      }
      newAmountDue = fee.amountDue.sub(discount);
      newStatus = this.recalcStatus(newAmountDue, fee.amountPaid, fee.dueDate);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.studentFee.update({
        where: { id },
        data: {
          amountDue: newAmountDue,
          status: newStatus,
        },
        include: studentFeeInclude,
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          entityType: 'StudentFee',
          entityId: id,
          action: auditAction,
          diff: {
            type: dto.type,
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
        where: { tenantId, teacherId: user.id },
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
        select: { teacherId: true },
      });
      if (cls?.teacherId !== user.id) throw new NotFoundException('Student fee not found');
    }
  }
}
