import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RoyaltyTerm } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';
import { fromPaise, toPaise } from '../petty-cash/petty-cash.math';
import {
  RoyaltyPaymentDto,
  RoyaltyTermsDto,
  VoidRoyaltyPaymentDto,
} from './dto/groups.dto';
import { HeadOfficeService } from './head-office.service';
import {
  addMonths,
  outstandingPaise,
  statement,
  STATEMENT_MONTHS,
  Term,
} from './royalty.math';

const err = (code: string, message: string) => ({ code, message });
const TIMEZONE = 'Asia/Kolkata';

const toTerm = (t: RoyaltyTerm): Term => ({
  mode: t.mode,
  percent: t.percent === null ? null : Number(t.percent),
  fixedPaise: t.fixedAmount === null ? null : toPaise(t.fixedAmount),
  minimumPaise: t.minimumAmount === null ? null : toPaise(t.minimumAmount),
  effectiveFrom: t.effectiveFrom,
});

const termView = (t: Term | null) =>
  t && {
    mode: t.mode,
    percent: t.percent,
    fixedAmount: t.fixedPaise === null ? null : fromPaise(t.fixedPaise),
    minimumAmount: t.minimumPaise === null ? null : fromPaise(t.minimumPaise),
    effectiveFrom: t.effectiveFrom,
  };

/**
 * Royalty from franchise branches (docs/SPEC-franchise.md §7). The head office
 * sets each branch's terms and records what it received; dues are derived
 * from the branch's fee receipts, never stored. Only branches whose plan
 * shows data to the head office are included. Every write is audit-logged.
 */
@Injectable()
export class RoyaltiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly headOffice: HeadOfficeService,
  ) {}

  /** Each branch: terms in force, this month so far, and what is still owed. */
  async summary(user: ActiveUser) {
    const group = await this.requireGroup(user);
    const branches = await this.headOffice.liveBranches(group.id);
    const month = this.currentMonth();
    const data = await this.load(
      group.id,
      branches.map((b) => b.id),
    );
    const rows = branches.map((b) => {
      const st = this.statementOf(data, b.id, month);
      const now = st.find((r) => r.month === month);
      return {
        id: b.id,
        name: b.name,
        term: termView(now?.term ?? null),
        thisMonth: {
          collected: fromPaise(now?.collectedPaise ?? 0),
          due: fromPaise(now?.duePaise ?? 0),
          received: fromPaise(now?.receivedPaise ?? 0),
        },
        outstanding: fromPaise(outstandingPaise(st, month)),
        lastReceivedOn: data.lastReceived.get(b.id) ?? null,
      };
    });
    const sum = (f: (r: (typeof rows)[number]) => string) =>
      fromPaise(rows.reduce((t, r) => t + toPaise(f(r)), 0));
    return {
      month,
      branches: rows,
      totals: {
        dueThisMonth: sum((r) => r.thisMonth.due),
        receivedThisMonth: sum((r) => r.thisMonth.received),
        outstanding: sum((r) => r.outstanding),
      },
    };
  }

  /** One branch: month-by-month statement, terms history and payments. */
  async branch(user: ActiveUser, tenantId: string) {
    const group = await this.requireGroup(user);
    const b = await this.requireBranch(group.id, tenantId);
    const month = this.currentMonth();
    const data = await this.load(group.id, [b.id]);
    const st = this.statementOf(data, b.id, month);
    const [terms, payments] = await Promise.all([
      this.prisma.royaltyTerm.findMany({
        where: { groupId: group.id, tenantId: b.id },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.royaltyPayment.findMany({
        where: { groupId: group.id, tenantId: b.id },
        orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);
    return {
      id: b.id,
      name: b.name,
      month,
      outstanding: fromPaise(outstandingPaise(st, month)),
      months: st
        .map((r) => ({
          month: r.month,
          collected: fromPaise(r.collectedPaise),
          term: termView(r.term),
          due: fromPaise(r.duePaise),
          received: fromPaise(r.receivedPaise),
          balance: fromPaise(r.balancePaise),
        }))
        .reverse(),
      terms: terms.map((t) => ({
        id: t.id,
        ...termView(toTerm(t))!,
        createdAt: t.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        month: p.month,
        amount: fromPaise(toPaise(p.amount)),
        receivedOn: fromDbDate(p.receivedOn),
        reference: p.reference,
        note: p.note,
        voided: p.voidedAt !== null,
        voidReason: p.voidReason,
        createdAt: p.createdAt,
      })),
    };
  }

  async setTerms(user: ActiveUser, tenantId: string, dto: RoyaltyTermsDto) {
    const group = await this.requireGroup(user);
    const b = await this.requireBranch(group.id, tenantId);
    if (
      dto.effectiveFrom <
      addMonths(this.currentMonth(), -(STATEMENT_MONTHS - 1))
    )
      throw new BadRequestException(
        err('MONTH_TOO_OLD', 'Terms can start at most 24 months back'),
      );
    const percent = dto.mode === 'percent';
    await this.prisma.$transaction(async (tx) => {
      const t = await tx.royaltyTerm.create({
        data: {
          groupId: group.id,
          tenantId: b.id,
          mode: dto.mode,
          percent: percent ? dto.percent! : null,
          fixedAmount: percent ? null : dto.fixedAmount!,
          minimumAmount:
            percent && dto.minimumAmount ? dto.minimumAmount : null,
          effectiveFrom: dto.effectiveFrom,
          createdBy: user.id,
        },
      });
      await this.audit(tx, user, 'group.royalty.terms', t.id, {
        groupId: group.id,
        tenantId: b.id,
        mode: dto.mode,
        percent: t.percent?.toString() ?? null,
        fixedAmount: t.fixedAmount?.toString() ?? null,
        minimumAmount: t.minimumAmount?.toString() ?? null,
        effectiveFrom: dto.effectiveFrom,
      });
    });
    return this.branch(user, b.id);
  }

  async recordPayment(
    user: ActiveUser,
    tenantId: string,
    dto: RoyaltyPaymentDto,
  ) {
    const group = await this.requireGroup(user);
    const b = await this.requireBranch(group.id, tenantId);
    const today = todayIn(TIMEZONE);
    if (dto.receivedOn > today)
      throw new BadRequestException(
        err('DATE_IN_FUTURE', 'The date received cannot be in the future'),
      );
    if (dto.month > this.currentMonth())
      throw new BadRequestException(
        err('MONTH_IN_FUTURE', 'Record a payment for this month or earlier'),
      );
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.royaltyPayment.create({
        data: {
          groupId: group.id,
          tenantId: b.id,
          month: dto.month,
          amount: dto.amount,
          receivedOn: toDbDate(dto.receivedOn),
          reference: dto.reference || null,
          note: dto.note || null,
          recordedBy: user.id,
        },
      });
      await this.audit(tx, user, 'group.royalty.payment', p.id, {
        groupId: group.id,
        tenantId: b.id,
        month: dto.month,
        amount: p.amount.toString(),
        receivedOn: dto.receivedOn,
        reference: dto.reference || null,
      });
    });
    return this.branch(user, b.id);
  }

  async voidPayment(
    user: ActiveUser,
    paymentId: string,
    dto: VoidRoyaltyPaymentDto,
  ) {
    const group = await this.requireGroup(user);
    const p = await this.prisma.royaltyPayment.findFirst({
      where: { id: paymentId, groupId: group.id },
    });
    if (!p)
      throw new NotFoundException(
        err('PAYMENT_NOT_FOUND', 'Payment not found'),
      );
    if (p.voidedAt)
      throw new BadRequestException(
        err('ALREADY_VOIDED', 'This payment is already voided'),
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.royaltyPayment.update({
        where: { id: p.id },
        data: {
          voidedAt: new Date(),
          voidedBy: user.id,
          voidReason: dto.reason,
        },
      });
      await this.audit(tx, user, 'group.royalty.void', p.id, {
        groupId: group.id,
        tenantId: p.tenantId,
        month: p.month,
        amount: p.amount.toString(),
        reason: dto.reason,
      });
    });
    return this.branch(user, p.tenantId);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private currentMonth() {
    return todayIn(TIMEZONE).slice(0, 7);
  }

  private async requireGroup(user: ActiveUser) {
    const group = await this.headOffice.groupOf(user);
    if (!group)
      throw new NotFoundException(
        err('GROUP_NOT_FOUND', 'Your login is not linked to a group'),
      );
    return group;
  }

  /** A branch of the group whose plan shows data to the head office. */
  private async requireBranch(groupId: string, tenantId: string) {
    const b = (await this.headOffice.liveBranches(groupId)).find(
      (x) => x.id === tenantId,
    );
    if (!b)
      throw new NotFoundException(
        err('BRANCH_NOT_IN_GROUP', 'This school is not part of your group'),
      );
    return b;
  }

  /** Terms, monthly fee collection and payments for branches, by month. */
  private async load(groupId: string, ids: string[]) {
    const from = addMonths(this.currentMonth(), -(STATEMENT_MONTHS - 1));
    const [terms, collected, payments] = ids.length
      ? await Promise.all([
          this.prisma.royaltyTerm.findMany({
            where: { groupId, tenantId: { in: ids } },
          }),
          this.prisma.$queryRaw<
            { tenant_id: string; month: string; amount: Prisma.Decimal }[]
          >`
            SELECT tenant_id, to_char(paid_on, 'YYYY-MM') AS month, SUM(amount) AS amount
            FROM receipts
            WHERE tenant_id = ANY(${ids}::uuid[]) AND paid_on >= ${toDbDate(`${from}-01`)}
            GROUP BY 1, 2`,
          this.prisma.royaltyPayment.findMany({
            where: { groupId, tenantId: { in: ids }, voidedAt: null },
            select: {
              tenantId: true,
              month: true,
              amount: true,
              receivedOn: true,
            },
          }),
        ])
      : [[], [], []];
    const key = (tenantId: string, month: string) => `${tenantId}|${month}`;
    const collectedBy = new Map<string, number>();
    for (const c of collected)
      collectedBy.set(key(c.tenant_id, c.month), toPaise(c.amount));
    const receivedBy = new Map<string, number>();
    const lastReceived = new Map<string, string>();
    for (const p of payments) {
      const k = key(p.tenantId, p.month);
      receivedBy.set(k, (receivedBy.get(k) ?? 0) + toPaise(p.amount));
      const on = fromDbDate(p.receivedOn);
      if (on > (lastReceived.get(p.tenantId) ?? ''))
        lastReceived.set(p.tenantId, on);
    }
    return { terms, collectedBy, receivedBy, lastReceived, key };
  }

  private statementOf(
    data: Awaited<ReturnType<RoyaltiesService['load']>>,
    tenantId: string,
    month: string,
  ) {
    const only = (m: Map<string, number>) =>
      new Map(
        [...m]
          .filter(([k]) => k.startsWith(`${tenantId}|`))
          .map(([k, v]) => [k.slice(tenantId.length + 1), v]),
      );
    return statement(
      data.terms.filter((t) => t.tenantId === tenantId).map(toTerm),
      only(data.collectedBy),
      only(data.receivedBy),
      month,
    );
  }

  private audit(
    tx: Prisma.TransactionClient,
    user: ActiveUser,
    action: string,
    entityId: string,
    diff: Prisma.InputJsonValue,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId: null,
        actorId: user.id,
        action,
        entityType: 'royalty',
        entityId,
        diff,
      },
    });
  }
}
