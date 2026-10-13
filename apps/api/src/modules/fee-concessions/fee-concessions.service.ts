import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertFeatureEnabled } from '../../common/tenant-features';
import { todayIn, toDbDate, fromDbDate } from '../attendance/attendance-dates';
import { feeStatusFor } from '../fees/fee-status.util';
import { concessionReductions } from './fee-concession.util';
import { CreateFeeConcessionDto } from './dto/create-fee-concession.dto';

/** Percentage fee concessions (features.feeConcession). */
@Injectable()
export class FeeConcessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForStudent(tenantId: string, studentId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'feeConcession');
    return this.prisma.feeConcession.findMany({
      where: { tenantId, studentId },
      include: { feeItem: { select: { id: true, label: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Total concession given today (school's timezone) — dashboard card. */
  async todayTotal(tenantId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'feeConcession');
    const today = await this.schoolToday(tenantId);
    const agg = await this.prisma.feeConcession.aggregate({
      where: { tenantId, givenOn: toDbDate(today) },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return {
      date: today,
      total: Number(agg._sum.amount ?? 0),
      count: agg._count._all,
    };
  }

  /**
   * Reduces the unpaid balance of every outstanding fee component the
   * concession covers, re-totals each affected fee, and records the rupee
   * amount given — all in one transaction.
   */
  async create(tenantId: string, dto: CreateFeeConcessionDto, actorId: string) {
    await assertFeatureEnabled(this.prisma, tenantId, 'feeConcession');
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId, tenantId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const fees = await this.prisma.studentFee.findMany({
      where: { tenantId, studentId: dto.studentId },
      include: { components: true },
    });
    if (
      dto.feeItemId &&
      !fees.some((f) => f.components.some((c) => c.feeItemId === dto.feeItemId))
    ) {
      throw new NotFoundException('Fee item not found for this student');
    }

    const percentage = new Prisma.Decimal(dto.percentage.toFixed(2));
    const feeUpdates: Prisma.PrismaPromise<unknown>[] = [];
    let total = new Prisma.Decimal(0);

    for (const fee of fees) {
      const reductions = concessionReductions(
        fee.components,
        percentage,
        dto.feeItemId ?? null,
      );
      if (reductions.size === 0) continue;

      let feeAmountDue = new Prisma.Decimal(0);
      for (const c of fee.components) {
        const reduction = reductions.get(c.id);
        const newAmountDue = reduction
          ? c.amountDue.sub(reduction)
          : c.amountDue;
        feeAmountDue = feeAmountDue.add(newAmountDue);
        if (!reduction) continue;
        total = total.add(reduction);
        feeUpdates.push(
          this.prisma.studentFeeComponent.update({
            where: { id: c.id },
            data: {
              amountDue: newAmountDue,
              status: feeStatusFor(newAmountDue, c.amountPaid, c.dueDate),
            },
          }),
        );
      }
      feeUpdates.push(
        this.prisma.studentFee.update({
          where: { id: fee.id },
          data: {
            amountDue: feeAmountDue,
            status: feeStatusFor(feeAmountDue, fee.amountPaid, fee.dueDate),
          },
        }),
      );
    }

    if (total.lessThanOrEqualTo(0)) {
      throw new BadRequestException({
        code: 'NOTHING_OUTSTANDING',
        message:
          'This student has no outstanding fees to apply a concession to',
      });
    }

    const givenOn = toDbDate(await this.schoolToday(tenantId));
    const [concession] = await this.prisma.$transaction([
      this.prisma.feeConcession.create({
        data: {
          tenantId,
          studentId: dto.studentId,
          feeItemId: dto.feeItemId ?? null,
          percentage,
          amount: total,
          reason: dto.reason?.trim() || null,
          givenOn,
          createdById: actorId,
        },
        include: { feeItem: { select: { id: true, label: true } } },
      }),
      ...feeUpdates,
      this.prisma.auditLog.create({
        data: {
          tenantId,
          actorId,
          entityType: 'Student',
          entityId: dto.studentId,
          action: 'fee_concession',
          diff: {
            percentage: percentage.toFixed(2),
            feeItemId: dto.feeItemId ?? null,
            amount: total.toFixed(2),
            reason: dto.reason ?? null,
          },
        },
      }),
    ]);

    return { ...concession, givenOn: fromDbDate(concession.givenOn) };
  }

  private async schoolToday(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return todayIn(tenant.timezone);
  }
}
