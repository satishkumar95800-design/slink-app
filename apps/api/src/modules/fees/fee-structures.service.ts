import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { NotificationChannel, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BroadcastTarget } from '../notifications/dto/broadcast-notification.dto';
import type { ActiveUser } from '../../common/types/active-user.type';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { AssignFeeStructureDto } from './dto/assign-fee-structure.dto';
import { FeeStructureQueryDto } from './dto/fee-structure-query.dto';

const feeStructureInclude = {
  class: { select: { id: true, name: true, academicYear: true } },
  items: {
    select: { id: true, label: true, amount: true },
    orderBy: { label: 'asc' as const },
  },
  _count: { select: { studentFees: true } },
} satisfies Prisma.FeeStructureInclude;

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
    const where: Prisma.FeeStructureWhereInput = { tenantId };

    if (query.academicYear) where.academicYear = query.academicYear;

    if (query.classId) {
      where.classId = query.classId;
    } else if (user.role === Role.teacher) {
      // Teachers only see structures for their assigned class(es)
      const teacherClasses = await this.prisma.class.findMany({
        where: { tenantId, teacherId: user.id },
        select: { id: true },
      });
      where.classId = { in: teacherClasses.map((c) => c.id) };
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

    if (user.role === Role.teacher) {
      const cls = await this.prisma.class.findUnique({
        where: { id: structure.classId },
        select: { teacherId: true },
      });
      if (cls?.teacherId !== user.id) {
        throw new NotFoundException('Fee structure not found');
      }
    }

    return structure;
  }

  async create(tenantId: string, dto: CreateFeeStructureDto) {
    await this.requireClass(tenantId, dto.classId);

    const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);

    return this.prisma.feeStructure.create({
      data: {
        tenantId,
        name: dto.name,
        classId: dto.classId,
        academicYear: dto.academicYear,
        dueDate: new Date(dto.dueDate),
        lateFeePerDay: dto.lateFeePerDay ?? 0,
        totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
        items: {
          create: dto.items.map((item) => ({
            label: item.label,
            amount: new Prisma.Decimal(item.amount.toFixed(2)),
          })),
        },
      },
      include: feeStructureInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateFeeStructureDto) {
    await this.requireFeeStructure(tenantId, id);

    const data: Prisma.FeeStructureUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.lateFeePerDay !== undefined)
      data.lateFeePerDay = new Prisma.Decimal(dto.lateFeePerDay.toFixed(2));

    if (dto.items !== undefined) {
      const totalAmount = dto.items.reduce((sum, item) => sum + item.amount, 0);
      data.totalAmount = new Prisma.Decimal(totalAmount.toFixed(2));
      // Replace all items: delete existing, create new
      data.items = {
        deleteMany: {},
        create: dto.items.map((item) => ({
          label: item.label,
          amount: new Prisma.Decimal(item.amount.toFixed(2)),
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
   * Assign this fee structure to every student currently enrolled in its class.
   * Students who already have an assignment for this structure are skipped.
   * Returns a summary of how many were assigned vs skipped.
   */
  async assignToClass(
    tenantId: string,
    feeStructureId: string,
    dto: AssignFeeStructureDto,
    actor: ActiveUser,
  ) {
    const structure = await this.requireFeeStructure(tenantId, feeStructureId);

    const students = await this.prisma.student.findMany({
      where: { tenantId, classId: structure.classId },
      select: { id: true },
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
    const amountDue = dto.amountDueOverride
      ? new Prisma.Decimal(dto.amountDueOverride.toFixed(2))
      : structure.totalAmount;
    const dueDate = dto.dueDateOverride
      ? new Date(dto.dueDateOverride)
      : structure.dueDate;

    if (toAssign.length > 0) {
      await this.prisma.studentFee.createMany({
        data: toAssign.map((s) => ({
          tenantId,
          studentId: s.id,
          feeStructureId,
          amountDue,
          dueDate,
        })),
      });
    }

    if (dto.notifyParents) {
      await this.notifications.broadcast(
        tenantId,
        {
          channel: NotificationChannel.fcm,
          title: `Fee due: ${structure.name}`,
          body: `A fee of ₹${amountDue.toFixed(2)} is due by ${dueDate.toISOString().slice(0, 10)}. Please pay via the School Connect app.`,
          targetType: BroadcastTarget.CLASS,
          targetId: structure.classId,
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

  private async requireFeeStructure(tenantId: string, id: string) {
    const s = await this.prisma.feeStructure.findUnique({
      where: { id, tenantId },
    });
    if (!s) throw new NotFoundException('Fee structure not found');
    return s;
  }

  private async requireClass(tenantId: string, classId: string) {
    const c = await this.prisma.class.findUnique({
      where: { id: classId, tenantId },
    });
    if (!c) throw new NotFoundException('Class not found');
    return c;
  }
}
