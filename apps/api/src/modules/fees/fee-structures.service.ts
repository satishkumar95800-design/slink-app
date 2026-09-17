import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FeeStatus, NotificationChannel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BroadcastTarget } from '../notifications/dto/broadcast-notification.dto';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { AssignFeeStructureDto } from './dto/assign-fee-structure.dto';
import { FeeStructureQueryDto } from './dto/fee-structure-query.dto';
import { RolloverArrearsDto } from './dto/rollover-arrears.dto';
import { buildStudentFeeComponents } from './fee-assignment.util';
import type { ApplicableStudentDiscount } from '../discounts/discount-application.util';

const feeStructureInclude = {
  classes: {
    select: {
      class: {
        select: {
          id: true,
          name: true,
          section: true,
          academicYear: true,
          teachers: { select: { teacherId: true } },
        },
      },
    },
  },
  items: {
    select: {
      id: true,
      label: true,
      amount: true,
      billingFrequency: true,
      quarterMonthCounts: true,
      isTransportFee: true,
    },
    orderBy: { label: 'asc' as const },
  },
  _count: { select: { studentFees: true } },
} satisfies Prisma.FeeStructureInclude;

type FeeStructureWithRelations = Prisma.FeeStructureGetPayload<{
  include: typeof feeStructureInclude;
}>;

@Injectable()
export class FeeStructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(
    tenantId: string,
    user: ActiveUser,
    query: FeeStructureQueryDto,
  ) {
    const where: Prisma.FeeStructureWhereInput = { tenantId, isSystem: false };

    if (query.academicYear) where.academicYear = query.academicYear;

    if (query.classId) {
      where.classes = { some: { classId: query.classId } };
    } else if (user.role === Role.teacher) {
      // Teachers only see structures for their assigned class(es)
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teachers: { some: { teacherId: user.id } } },
        select: { id: true },
      });
      where.classes = { some: { classId: { in: teacherClasses.map((c) => c.id) } } };
    }

    return this.prisma.feeStructure.findMany({
      where,
      include: feeStructureInclude,
      orderBy: [{ academicYear: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string, user: ActiveUser) {
    const structure = await this.prisma.feeStructure.findUnique({
      where: { id, tenantId },
      include: feeStructureInclude,
    });

    if (!structure) throw new NotFoundException('Fee structure not found');

    if (user.role === Role.teacher && !this.isTeacherPlan(structure, user.id)) {
      throw new NotFoundException('Fee structure not found');
    }

    return structure;
  }

  async create(tenantId: string, dto: CreateFeeStructureDto) {
    await this.requireClasses(tenantId, dto.classIds);
    this.validateItems(dto.items);

    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    return this.prisma.feeStructure.create({
      data: {
        tenantId,
        name: dto.name,
        academicYear: dto.academicYear,
        dueDate: new Date(dto.dueDate),
        lateFeePerDay: dto.lateFeePerDay ?? 0,
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        classes: {
          create: dto.classIds.map((classId) => ({ classId })),
        },
        items: {
          create: dto.items.map((item) => ({
            label: item.label,
            amount: new Prisma.Decimal(item.amount.toFixed(2)),
            billingFrequency: item.billingFrequency,
            quarterMonthCounts: item.quarterMonthCounts ?? [],
            isTransportFee: item.isTransportFee ?? false,
          })),
        },
      },
      include: feeStructureInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateFeeStructureDto) {
    await this.requireFeeStructure(tenantId, id);
    if (dto.classIds !== undefined) await this.requireClasses(tenantId, dto.classIds);

    const data: Prisma.FeeStructureUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.lateFeePerDay !== undefined)
      data.lateFeePerDay = new Prisma.Decimal(dto.lateFeePerDay.toFixed(2));

    if (dto.classIds !== undefined) {
      data.classes = {
        deleteMany: {},
        create: dto.classIds.map((classId) => ({ classId })),
      };
    }

    if (dto.items !== undefined) {
      this.validateItems(dto.items);
      const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);
      data.totalAmount = new Prisma.Decimal(totalAmount.toFixed(2));
      // Replace all items: delete existing, create new
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          label: item.label,
          amount: new Prisma.Decimal(item.amount.toFixed(2)),
          billingFrequency: item.billingFrequency,
          quarterMonthCounts: item.quarterMonthCounts ?? [],
          isTransportFee: item.isTransportFee ?? false,
        })),
      };
    }

    return this.prisma.feeStructure.update({
      where: { id },
      data,
      include: feeStructureInclude,
    });
  }

  async remove(tenantId: string, id: string) {
    const structure = await this.requireFeeStructure(tenantId, id);

    const assignedCount = await this.prisma.studentFee.count({
      where: { feeStructureId: id },
    });
    if (assignedCount > 0) {
      throw new ConflictException(
        `Cannot delete: fee structure is assigned to ${assignedCount} student(s)`,
      );
    }

    await this.prisma.feeStructure.delete({ where: { id: structure.id } });
  }

  /**
   * Assign this fee structure to every student currently enrolled in one of
   * its linked classes. Students who already have an assignment for this
   * structure are skipped. Each new assignment explodes the plan's fee items
   * into per-period StudentFeeComponent rows and applies the student's tagged
   * discounts (if any). Returns a summary of how many were assigned vs skipped.
   */
  async assignToClass(
    tenantId: string,
    feeStructureId: string,
    dto: AssignFeeStructureDto,
    actor: ActiveUser,
  ) {
    const structure = await this.requireFeeStructureWithItems(tenantId, feeStructureId);

    const linkedClassIds = new Set(structure.classes.map((c) => c.classId));
    if (!linkedClassIds.has(dto.classId)) {
      throw new BadRequestException('This fee structure is not linked to the given class');
    }

    const students = await this.prisma.student.findMany({
      where: { tenantId, classId: dto.classId },
      select: { id: true, transportSlab: { select: { monthlyAmount: true } } },
    });

    if (students.length === 0) {
      throw new BadRequestException('No students found in this class');
    }

    const existingLinks = await this.prisma.studentFee.findMany({
      where: { feeStructureId, studentId: { in: students.map((s) => s.id) } },
      select: { studentId: true },
    });
    const alreadyAssigned = new Set(existingLinks.map((l) => l.studentId));
    const toAssign = students.filter((s) => !alreadyAssigned.has(s.id));

    const dueDate = dto.dueDateOverride ? new Date(dto.dueDateOverride) : structure.dueDate;

    if (toAssign.length > 0) {
      const discountsByStudent = await this.loadDiscountsByStudent(
        tenantId,
        toAssign.map((s) => s.id),
      );

      for (const student of toAssign) {
        const components = buildStudentFeeComponents(
          structure,
          discountsByStudent.get(student.id) ?? [],
          student.transportSlab?.monthlyAmount,
        );
        const amountDue = dto.amountDueOverride
          ? new Prisma.Decimal(dto.amountDueOverride.toFixed(2))
          : components.reduce((sum, c) => sum.add(c.amountDue), new Prisma.Decimal(0));

        await this.prisma.studentFee.create({
          data: {
            tenantId,
            studentId: student.id,
            feeStructureId,
            amountDue,
            dueDate,
            components: { create: components },
          },
        });
      }
    }

    if (dto.notifyParents) {
      const amountDue = dto.amountDueOverride ?? structure.totalAmount.toNumber();
      await this.notifications.broadcast(
        tenantId,
        {
          channel: NotificationChannel.fcm,
          title: `Fee due: ${structure.name}`,
          body: `A fee of ₹${amountDue.toFixed(2)} is due by ${dueDate.toISOString().slice(0, 10)}. Please pay via the School Connect app.`,
          targetType: BroadcastTarget.CLASS,
          targetId: dto.classId,
        },
        actor,
      );
    }

    return {
      total: students.length,
      assigned: toAssign.length,
      skipped: alreadyAssigned.size,
    };
  }

  /**
   * Year-end arrears carry-forward (Addendum 3 §2.2): every student with an
   * outstanding balance in fromAcademicYear gets a "Previous Year Dues" line
   * item on toAcademicYear, automating what schools otherwise do by manually
   * copying balances between year-tabs. Idempotent — students already carried
   * forward (a StudentFee already exists on the system plan) are skipped, so
   * this can be safely re-run.
   */
  async rolloverArrears(tenantId: string, dto: RolloverArrearsDto) {
    const outstandingFees = await this.prisma.studentFee.findMany({
      where: {
        tenantId,
        status: { notIn: [FeeStatus.paid, FeeStatus.waived] },
        feeStructure: { academicYear: dto.fromAcademicYear },
      },
      select: { studentId: true, amountDue: true, amountPaid: true },
    });

    const balanceByStudent = new Map<string, Prisma.Decimal>();
    for (const fee of outstandingFees) {
      const outstanding = fee.amountDue.sub(fee.amountPaid);
      if (outstanding.lessThanOrEqualTo(0)) continue;
      balanceByStudent.set(
        fee.studentId,
        (balanceByStudent.get(fee.studentId) ?? new Prisma.Decimal(0)).add(outstanding),
      );
    }

    if (balanceByStudent.size === 0) {
      return { studentsProcessed: 0, totalCarried: '0.00' };
    }

    const dueDate = new Date(dto.dueDate);
    const systemName = 'Previous Year Dues';

    let systemStructure = await this.prisma.feeStructure.findUnique({
      where: { tenantId_name_academicYear: { tenantId, name: systemName, academicYear: dto.toAcademicYear } },
      include: { items: true },
    });
    if (!systemStructure) {
      systemStructure = await this.prisma.feeStructure.create({
        data: {
          tenantId,
          name: systemName,
          academicYear: dto.toAcademicYear,
          dueDate,
          totalAmount: new Prisma.Decimal(0),
          isSystem: true,
          items: {
            create: [{ label: systemName, amount: new Prisma.Decimal(0), billingFrequency: 'one_time' }],
          },
        },
        include: { items: true },
      });
    }
    const systemItem = systemStructure.items[0];

    let processed = 0;
    let totalCarried = new Prisma.Decimal(0);
    for (const [studentId, balance] of balanceByStudent) {
      const existing = await this.prisma.studentFee.findUnique({
        where: { studentId_feeStructureId: { studentId, feeStructureId: systemStructure.id } },
      });
      if (existing) continue;

      await this.prisma.studentFee.create({
        data: {
          tenantId,
          studentId,
          feeStructureId: systemStructure.id,
          amountDue: balance,
          dueDate,
          components: {
            create: [
              {
                feeItemId: systemItem.id,
                periodLabel: systemName,
                periodStart: dueDate,
                periodEnd: dueDate,
                dueDate,
                amountDue: balance,
              },
            ],
          },
        },
      });
      processed++;
      totalCarried = totalCarried.add(balance);
    }

    return { studentsProcessed: processed, totalCarried: totalCarried.toFixed(2) };
  }

  private isTeacherPlan(structure: FeeStructureWithRelations, teacherId: string) {
    return structure.classes.some((link) =>
      link.class.teachers.some((t) => t.teacherId === teacherId),
    );
  }

  private async loadDiscountsByStudent(tenantId: string, studentIds: string[]) {
    const discounts = await this.prisma.studentDiscount.findMany({
      where: { tenantId, studentId: { in: studentIds } },
      include: { discountType: { select: { kind: true } } },
    });

    const byStudent = new Map<string, ApplicableStudentDiscount[]>();
    for (const d of discounts) {
      const list = byStudent.get(d.studentId) ?? [];
      list.push({
        kind: d.discountType.kind,
        feeItemId: d.feeItemId,
        percentage: d.percentage,
        fixedAmount: d.fixedAmount,
      });
      byStudent.set(d.studentId, list);
    }
    return byStudent;
  }

  private async requireFeeStructure(tenantId: string, id: string) {
    const s = await this.prisma.feeStructure.findUnique({
      where: { id, tenantId },
    });
    if (!s) throw new NotFoundException('Fee structure not found');
    return s;
  }

  private async requireFeeStructureWithItems(tenantId: string, id: string) {
    const s = await this.prisma.feeStructure.findUnique({
      where: { id, tenantId },
      include: { items: true, classes: { select: { classId: true } } },
    });
    if (!s) throw new NotFoundException('Fee structure not found');
    return s;
  }

  private validateItems(items: CreateFeeStructureDto['items']) {
    for (const item of items) {
      if (item.billingFrequency === 'quarterly') {
        const counts = item.quarterMonthCounts ?? [];
        const sum = counts.reduce((s, c) => s + c, 0);
        // Quarters don't have to tile the whole academic year — e.g. Poorna's
        // transport quarters (3,3,2,2 = 10 months) skip unbilled vacation
        // months. They just can't exceed the 12-month year.
        if (sum === 0 || sum > 12) {
          throw new BadRequestException(
            `quarterMonthCounts for "${item.label}" must sum to between 1 and 12 (got ${sum})`,
          );
        }
      }
    }
  }

  private async requireClasses(tenantId: string, classIds: string[]) {
    const found = await this.prisma.class.findMany({
      where: { id: { in: classIds }, tenantId },
      select: { id: true },
    });
    if (found.length !== new Set(classIds).size) {
      throw new NotFoundException('One or more classes not found');
    }
  }
}
