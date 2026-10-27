import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  PLAN_LABEL,
  nextPeriodStart,
  oneYearFrom,
  presetFlags,
} from '../../common/subscription';
import {
  fromDbDate,
  isValidYmd,
  toDbDate,
  todayIn,
} from '../attendance/attendance-dates';
import {
  TenantRow,
  tenantSelect,
  withSubscription,
} from '../tenants/tenants.service';
import {
  RenewSubscriptionDto,
  UpdateSubscriptionDto,
} from './dto/subscriptions.dto';

const err = (code: string, message: string) => ({ code, message });

/** The school's flags with the plan's modules switched to its preset. */
const mergedFlags = (t: TenantRow, plan: SubscriptionPlan) =>
  ({
    ...((t.features ?? {}) as Prisma.JsonObject),
    ...presetFlags(plan),
  }) as Prisma.InputJsonObject;

/**
 * Subscription plan, period and renewals for the platform team
 * (docs/SPEC-subscriptions.md). Status is derived from the end date; a school
 * more than GRACE_DAYS past it is switched off by TenantMiddleware.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Corrects the plan or dates without recording a renewal. */
  async update(tenantId: string, dto: UpdateSubscriptionDto, user: ActiveUser) {
    const t = await this.require(tenantId);
    const startsOn = dto.startsOn ?? fromDbDate(t.subscriptionStartsOn);
    const endsOn = dto.endsOn ?? fromDbDate(t.subscriptionEndsOn);
    this.assertPeriod(startsOn, endsOn);
    const features = dto.plan ? mergedFlags(t, dto.plan) : undefined;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.plan && { subscriptionPlan: dto.plan, features }),
          subscriptionStartsOn: toDbDate(startsOn),
          subscriptionEndsOn: toDbDate(endsOn),
        },
        select: tenantSelect,
      });
      await this.audit(tx, tenantId, user.id, 'subscription.update', {
        before: {
          plan: t.subscriptionPlan,
          startsOn: fromDbDate(t.subscriptionStartsOn),
          endsOn: fromDbDate(t.subscriptionEndsOn),
        },
        after: { plan: updated.subscriptionPlan, startsOn, endsOn },
      });
      return updated;
    });
    return withSubscription(row);
  }

  /**
   * Marks the school renewed: the new period starts the day after the current
   * end (or today, if it was already switched off) and runs a year.
   */
  async renew(tenantId: string, dto: RenewSubscriptionDto, user: ActiveUser) {
    const t = await this.require(tenantId);
    const today = todayIn(t.timezone || 'Asia/Kolkata');
    const previousEndsOn = fromDbDate(t.subscriptionEndsOn);
    // A trial's paid year starts the day after the trial (today if it ran out).
    const startsOn = nextPeriodStart(previousEndsOn, today, t.onTrial);
    const endsOn = dto.endsOn ?? oneYearFrom(startsOn);
    this.assertPeriod(startsOn, endsOn);
    const plan: SubscriptionPlan = dto.plan ?? t.subscriptionPlan;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPlan: plan,
          subscriptionStartsOn: toDbDate(startsOn),
          subscriptionEndsOn: toDbDate(endsOn),
          onTrial: false,
          ...(dto.plan &&
            dto.plan !== t.subscriptionPlan && {
              features: mergedFlags(t, dto.plan),
            }),
        },
        select: tenantSelect,
      });
      const renewal = await tx.subscriptionRenewal.create({
        data: {
          tenantId,
          plan,
          previousEndsOn: toDbDate(previousEndsOn),
          startsOn: toDbDate(startsOn),
          endsOn: toDbDate(endsOn),
          amount: dto.amount ?? null,
          reference: dto.reference || null,
          note: dto.note || null,
          renewedBy: user.id,
        },
      });
      await this.audit(tx, tenantId, user.id, 'subscription.renew', {
        renewalId: renewal.id,
        plan,
        previousPlan: t.subscriptionPlan,
        previousEndsOn,
        startsOn,
        endsOn,
        amount: dto.amount ?? null,
        ...(t.onTrial && { fromTrial: true }),
      });
      return updated;
    });
    return withSubscription(row);
  }

  async history(tenantId: string) {
    await this.require(tenantId);
    const rows = await this.prisma.subscriptionRenewal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    const names = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: [...new Set(rows.map((r) => r.renewedBy))] } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      plan: r.plan,
      planName: PLAN_LABEL[r.plan],
      previousEndsOn: fromDbDate(r.previousEndsOn),
      startsOn: fromDbDate(r.startsOn),
      endsOn: fromDbDate(r.endsOn),
      amount: r.amount === null ? null : r.amount.toFixed(2),
      reference: r.reference,
      note: r.note,
      renewedBy: names.get(r.renewedBy) ?? '',
      createdAt: r.createdAt,
    }));
  }

  /** Schools due for renewal within 30 days, in grace, or switched off; soonest first. */
  async renewals() {
    const rows = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: tenantSelect,
      orderBy: { subscriptionEndsOn: 'asc' },
    });
    return rows
      .map(withSubscription)
      .filter((t) => t.subscription.status !== 'active')
      .map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        students: t._count.students,
        subscription: t.subscription,
      }));
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async require(id: string): Promise<TenantRow> {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (!t)
      throw new NotFoundException(err('SCHOOL_NOT_FOUND', 'Tenant not found'));
    return t;
  }

  private assertPeriod(startsOn: string, endsOn: string) {
    if (!isValidYmd(startsOn) || !isValidYmd(endsOn))
      throw new BadRequestException(err('DATE_INVALID', 'Not a valid date'));
    if (endsOn < startsOn)
      throw new BadRequestException(
        err(
          'PERIOD_INVALID',
          'The end date must be on or after the start date',
        ),
      );
  }

  private audit(
    db: Prisma.TransactionClient,
    tenantId: string,
    actorId: string,
    action: string,
    diff: Prisma.InputJsonValue,
  ) {
    return db.auditLog.create({
      data: {
        tenantId,
        actorId,
        action,
        entityType: 'subscription',
        entityId: tenantId,
        diff,
      },
    });
  }
}
