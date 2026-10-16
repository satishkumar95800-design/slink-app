import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PettyCashEntryType,
  PettyCashStatus,
  Role,
} from '@prisma/client';
import type { Express } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/dto/upload-file.dto';
import {
  fromDbDate,
  isValidYmd,
  monthRange,
  toDbDate,
  todayIn,
} from '../attendance/attendance-dates';
import {
  AdvanceQueryDto,
  CreateCategoryDto,
  CreateEntryDto,
  CreatePayeeDto,
  EntryQueryDto,
  StatementQueryDto,
  UpdateCategoryDto,
  UpdatePayeeDto,
  UpdateSettingsDto,
} from './dto/petty-cash.dto';
import {
  Advance,
  LedgerRow,
  computeAdvances,
  computeBalance,
  fromPaise,
  needsApproval,
  outstandingOn,
  reducesFloat,
  toPaise,
} from './petty-cash.math';
import {
  CSV_HEADERS,
  DEFAULT_CATEGORIES,
  pettyCashStrings as t,
} from './petty-cash.strings';

type Db = PrismaService | Prisma.TransactionClient;

export interface PettyCashSettings {
  thresholdPaise: number;
  monthlyBudgetPaise: number | null;
  receiptAbovePaise: number;
  overdueDays: number;
}

export interface ApprovedRow extends LedgerRow {
  categoryId: string | null;
}

/** Admin-level for approvals. super_admin follows the platform convention for finance data (admin equivalent). */
export const isApprover = (role: Role) =>
  role === Role.admin || role === Role.super_admin;

const MAX_EXPORT_ROWS = 10_000;

const entryInclude = {
  category: { select: { id: true, name: true } },
  payee: { select: { id: true, name: true, type: true } },
  recipientUser: { select: { id: true, name: true, role: true } },
} satisfies Prisma.PettyCashEntryInclude;

type EntryRow = Prisma.PettyCashEntryGetPayload<{
  include: typeof entryInclude;
}>;

const fail = (
  Exc: new (body: { code: string; message: string }) => Error,
  code: string,
  message: string,
): never => {
  throw new Exc({ code, message });
};

const recipientKeyOf = (e: {
  recipientUserId: string | null;
  payeeId: string | null;
}) =>
  e.recipientUserId
    ? `u:${e.recipientUserId}`
    : e.payeeId
      ? `p:${e.payeeId}`
      : null;

/** Spreadsheet formula injection guard for exported text. */
const csvCell = (value: string | number | null | undefined): string => {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

@Injectable()
export class PettyCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  // ── settings ──────────────────────────────────────────────────────────────

  /** Settings row (created with defaults on first use) + the default categories, once per school. */
  async getSettings(tenantId: string): Promise<PettyCashSettings> {
    let row = await this.prisma.pettyCashSetting.findUnique({
      where: { tenantId },
    });
    if (!row) {
      row = await this.prisma.pettyCashSetting.upsert({
        where: { tenantId },
        create: { tenantId },
        update: {},
      });
    }
    if (!row.categoriesSeeded) {
      await this.prisma.pettyCashCategory.createMany({
        data: DEFAULT_CATEGORIES.map((name) => ({ tenantId, name })),
        skipDuplicates: true,
      });
      await this.prisma.pettyCashSetting.update({
        where: { tenantId },
        data: { categoriesSeeded: true },
      });
    }
    return {
      thresholdPaise: toPaise(row.approvalThreshold),
      monthlyBudgetPaise:
        row.monthlyBudget === null ? null : toPaise(row.monthlyBudget),
      receiptAbovePaise: toPaise(row.receiptRequiredAbove),
      overdueDays: row.overdueDays,
    };
  }

  async getSettingsView(tenantId: string) {
    return this.settingsView(await this.getSettings(tenantId));
  }

  private settingsView(s: PettyCashSettings) {
    return {
      approvalThreshold: fromPaise(s.thresholdPaise),
      monthlyBudget:
        s.monthlyBudgetPaise === null ? null : fromPaise(s.monthlyBudgetPaise),
      receiptRequiredAbove: fromPaise(s.receiptAbovePaise),
      overdueDays: s.overdueDays,
    };
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateSettingsDto,
    user: ActiveUser,
  ) {
    const before = await this.getSettingsView(tenantId);
    const data: Prisma.PettyCashSettingUpdateInput = {
      ...(dto.approvalThreshold !== undefined && {
        approvalThreshold: fromPaise(toPaise(dto.approvalThreshold)),
      }),
      ...(dto.monthlyBudget !== undefined && {
        monthlyBudget:
          dto.monthlyBudget === null
            ? null
            : fromPaise(toPaise(dto.monthlyBudget)),
      }),
      ...(dto.receiptRequiredAbove !== undefined && {
        receiptRequiredAbove: fromPaise(toPaise(dto.receiptRequiredAbove)),
      }),
      ...(dto.overdueDays !== undefined && { overdueDays: dto.overdueDays }),
    };
    const row = await this.prisma.pettyCashSetting.update({
      where: { tenantId },
      data,
    });
    const after = this.settingsView({
      thresholdPaise: toPaise(row.approvalThreshold),
      monthlyBudgetPaise:
        row.monthlyBudget === null ? null : toPaise(row.monthlyBudget),
      receiptAbovePaise: toPaise(row.receiptRequiredAbove),
      overdueDays: row.overdueDays,
    });
    await this.audit(
      this.prisma,
      tenantId,
      user.id,
      'petty_cash.settings.update',
      'petty_cash_setting',
      tenantId,
      {
        before,
        after,
      },
    );
    return after;
  }

  // ── entries ───────────────────────────────────────────────────────────────

  async createEntry(tenantId: string, user: ActiveUser, dto: CreateEntryDto) {
    const settings = await this.getSettings(tenantId);
    const amountPaise = toPaise(dto.amount);
    await this.assertDate(tenantId, dto.date);
    const description = dto.description.trim();
    if (!description)
      fail(BadRequestException, 'DESCRIPTION_REQUIRED', t.descriptionRequired);

    this.assertShape(dto, amountPaise, settings, tenantId);

    const gated = needsApproval(amountPaise, settings.thresholdPaise);
    const approver = isApprover(user.role);
    const status: PettyCashStatus = gated && !approver ? 'PENDING' : 'APPROVED';
    const selfApproved = gated && approver;

    const created = await this.locked(tenantId, async (tx) => {
      await this.assertRefs(tx, tenantId, dto);
      if (status === 'APPROVED') {
        const rows = await this.loadApprovedRows(tx, tenantId);
        this.assertApplicable(
          {
            type: dto.type,
            amountPaise,
            settlesEntryId: dto.settlesEntryId ?? null,
          },
          rows,
          dto.date,
        );
      } else if (dto.settlesEntryId) {
        // A pending settlement must still point at a real approved disbursement.
        const rows = await this.loadApprovedRows(tx, tenantId);
        this.assertApplicable(
          { type: dto.type, amountPaise, settlesEntryId: dto.settlesEntryId },
          rows,
          dto.date,
          false,
        );
      }
      const row = await tx.pettyCashEntry.create({
        data: {
          tenantId,
          type: dto.type,
          amount: fromPaise(amountPaise),
          date: toDbDate(dto.date),
          categoryId: dto.categoryId ?? null,
          description,
          receiptKey: dto.receiptKey ?? null,
          recipientUserId: dto.recipientUserId ?? null,
          payeeId: dto.payeeId ?? null,
          settlesEntryId: dto.settlesEntryId ?? null,
          status,
          createdBy: user.id,
          ...(selfApproved && { approvedBy: user.id, approvedAt: new Date() }),
        },
        include: entryInclude,
      });
      await this.audit(
        tx,
        tenantId,
        user.id,
        'petty_cash.entry.create',
        'petty_cash_entry',
        row.id,
        {
          type: dto.type,
          amount: fromPaise(amountPaise),
          date: dto.date,
          status,
          selfApproved,
          thresholdExceeded: gated,
          recipientUserId: dto.recipientUserId ?? null,
          payeeId: dto.payeeId ?? null,
          settlesEntryId: dto.settlesEntryId ?? null,
        },
      );
      return row;
    });
    return (await this.toViews([created]))[0];
  }

  async approve(tenantId: string, id: string, user: ActiveUser) {
    this.assertApprover(user);
    const row = await this.locked(tenantId, async (tx) => {
      const entry = await tx.pettyCashEntry.findFirst({
        where: { id, tenantId },
      });
      if (!entry) throw new NotFoundException(t.entryNotFound);
      if (entry.status !== 'PENDING')
        fail(ConflictException, 'NOT_PENDING', t.notPending);
      if (entry.createdBy === user.id)
        fail(ForbiddenException, 'SELF_APPROVAL', t.selfApproval);
      const rows = await this.loadApprovedRows(tx, tenantId);
      this.assertApplicable(
        {
          type: entry.type,
          amountPaise: toPaise(entry.amount),
          settlesEntryId: entry.settlesEntryId,
        },
        rows,
        fromDbDate(entry.date),
      );
      const updated = await tx.pettyCashEntry.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: user.id,
          approvedAt: new Date(),
        },
        include: entryInclude,
      });
      await this.audit(
        tx,
        tenantId,
        user.id,
        'petty_cash.entry.approve',
        'petty_cash_entry',
        id,
        {
          amount: fromPaise(toPaise(entry.amount)),
          createdBy: entry.createdBy,
        },
      );
      return updated;
    });
    return (await this.toViews([row]))[0];
  }

  async reject(tenantId: string, id: string, reason: string, user: ActiveUser) {
    this.assertApprover(user);
    const row = await this.locked(tenantId, async (tx) => {
      const entry = await tx.pettyCashEntry.findFirst({
        where: { id, tenantId },
      });
      if (!entry) throw new NotFoundException(t.entryNotFound);
      if (entry.status !== 'PENDING')
        fail(ConflictException, 'NOT_PENDING', t.notPending);
      // approvedBy/approvedAt record the reviewer's decision, for rejections too.
      const updated = await tx.pettyCashEntry.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: reason.trim(),
          approvedBy: user.id,
          approvedAt: new Date(),
        },
        include: entryInclude,
      });
      await this.audit(
        tx,
        tenantId,
        user.id,
        'petty_cash.entry.reject',
        'petty_cash_entry',
        id,
        {
          reason: reason.trim(),
          amount: fromPaise(toPaise(entry.amount)),
        },
      );
      return updated;
    });
    return (await this.toViews([row]))[0];
  }

  /** Append-only corrections: a void keeps the row and its reason; the fix is a new entry. */
  async voidEntry(
    tenantId: string,
    id: string,
    reason: string,
    user: ActiveUser,
  ) {
    const settings = await this.getSettings(tenantId);
    const row = await this.locked(tenantId, async (tx) => {
      const entry = await tx.pettyCashEntry.findFirst({
        where: { id, tenantId },
      });
      if (!entry) throw new NotFoundException(t.entryNotFound);
      if (entry.status !== 'PENDING' && entry.status !== 'APPROVED')
        fail(ConflictException, 'NOT_VOIDABLE', t.notVoidable);
      const amountPaise = toPaise(entry.amount);

      if (entry.status === 'PENDING') {
        if (entry.createdBy !== user.id && !isApprover(user.role))
          fail(ForbiddenException, 'VOID_NOT_CREATOR', t.voidNotCreator);
      } else {
        if (
          needsApproval(amountPaise, settings.thresholdPaise) &&
          !isApprover(user.role)
        )
          fail(ForbiddenException, 'VOID_NEEDS_APPROVER', t.voidNeedsApprover);
        const rows = await this.loadApprovedRows(tx, tenantId);
        if (
          entry.type === 'DISBURSEMENT' &&
          rows.some((r) => r.settlesEntryId === id)
        )
          fail(ConflictException, 'HAS_SETTLEMENTS', t.hasSettlements);
        if (computeBalance(rows.filter((r) => r.id !== id)) < 0)
          fail(ConflictException, 'INSUFFICIENT_FLOAT', t.insufficientFloat);
      }
      const updated = await tx.pettyCashEntry.update({
        where: { id },
        data: {
          status: 'VOIDED',
          voidReason: reason.trim(),
          voidedBy: user.id,
          voidedAt: new Date(),
        },
        include: entryInclude,
      });
      await this.audit(
        tx,
        tenantId,
        user.id,
        'petty_cash.entry.void',
        'petty_cash_entry',
        id,
        {
          reason: reason.trim(),
          previousStatus: entry.status,
          amount: fromPaise(amountPaise),
        },
      );
      return updated;
    });
    return (await this.toViews([row]))[0];
  }

  async listEntries(tenantId: string, q: EntryQueryDto) {
    const where = this.entryWhere(tenantId, q);
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [total, rows] = await Promise.all([
      this.prisma.pettyCashEntry.count({ where }),
      this.prisma.pettyCashEntry.findMany({
        where,
        include: entryInclude,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: await this.toViews(rows), total, page, limit };
  }

  async receiptUrl(tenantId: string, id: string) {
    const entry = await this.prisma.pettyCashEntry.findFirst({
      where: { id, tenantId },
      select: { receiptKey: true },
    });
    if (!entry) throw new NotFoundException(t.entryNotFound);
    if (!entry.receiptKey) throw new NotFoundException(t.noReceipt);
    const url = await this.files.getSignedUrl(entry.receiptKey, tenantId);
    return { url };
  }

  async uploadReceipt(
    tenantId: string,
    file: Express.Multer.File,
    user: ActiveUser,
  ) {
    const res = await this.files.upload(
      tenantId,
      file,
      FileCategory.PETTY_CASH_RECEIPT,
    );
    await this.audit(
      this.prisma,
      tenantId,
      user.id,
      'petty_cash.receipt.upload',
      'petty_cash_receipt',
      null,
      {
        key: res.key,
        size: res.size,
      },
    );
    return { key: res.key, size: res.size, contentType: res.contentType };
  }

  async exportCsv(tenantId: string, q: EntryQueryDto): Promise<string> {
    const rows = await this.prisma.pettyCashEntry.findMany({
      where: this.entryWhere(tenantId, q),
      include: entryInclude,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: MAX_EXPORT_ROWS,
    });
    const views = await this.toViews(rows);
    const lines = [CSV_HEADERS.join(',')];
    for (const v of views) {
      lines.push(
        [
          v.date,
          v.type,
          v.status,
          v.amount,
          v.category?.name,
          v.recipient?.name,
          v.recipient?.kind,
          v.description,
          v.settlesEntryId,
          v.hasReceipt ? 'yes' : 'no',
          v.createdBy.name,
          v.reviewedBy?.name,
          v.rejectionReason ?? v.voidReason,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  // ── summary, advances, statements ────────────────────────────────────────

  async summary(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const today = todayIn(tenant?.timezone || 'Asia/Kolkata');
    const month = today.slice(0, 7);
    const { from, to } = monthRange(month);

    const rows = await this.loadApprovedRows(this.prisma, tenantId);
    const advances = computeAdvances(rows, settings.overdueDays, today);
    const open = advances.filter((a) => a.outstandingPaise > 0);
    const overdue = open.filter((a) => a.overdue);

    const spendRows = rows.filter(
      (r) => r.type === 'EXPENSE' && r.date >= from && r.date <= to,
    );
    const spend = spendRows.reduce((s, r) => s + r.amountPaise, 0);
    const cats = await this.prisma.pettyCashCategory.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    const byCategory = cats
      .map((c) => ({
        categoryId: c.id,
        name: c.name,
        isActive: c.isActive,
        spend: spendRows
          .filter((r) => r.categoryId === c.id)
          .reduce((s, r) => s + r.amountPaise, 0),
        budget: c.monthlyBudget === null ? null : toPaise(c.monthlyBudget),
      }))
      .filter((c) => c.spend > 0 || (c.budget !== null && c.isActive))
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.name,
        spend: fromPaise(c.spend),
        budget: c.budget === null ? null : fromPaise(c.budget),
        overBudget: c.budget !== null && c.spend > c.budget,
      }));

    const pending = await this.prisma.pettyCashEntry.findMany({
      where: { tenantId, status: 'PENDING' },
      select: { amount: true },
    });
    const pendingTotal = pending.reduce((s, p) => s + toPaise(p.amount), 0);

    return {
      today,
      balance: fromPaise(computeBalance(rows)),
      monthToDate: {
        month,
        spend: fromPaise(spend),
        budget:
          settings.monthlyBudgetPaise === null
            ? null
            : fromPaise(settings.monthlyBudgetPaise),
        overBudget:
          settings.monthlyBudgetPaise !== null &&
          spend > settings.monthlyBudgetPaise,
        usedPercent:
          settings.monthlyBudgetPaise && settings.monthlyBudgetPaise > 0
            ? Math.round((spend / settings.monthlyBudgetPaise) * 100)
            : null,
      },
      byCategory,
      openAdvances: {
        count: open.length,
        outstanding: fromPaise(
          open.reduce((s, a) => s + a.outstandingPaise, 0),
        ),
      },
      overdueAdvances: {
        count: overdue.length,
        outstanding: fromPaise(
          overdue.reduce((s, a) => s + a.outstandingPaise, 0),
        ),
      },
      pendingApprovals: {
        count: pending.length,
        total: fromPaise(pendingTotal),
      },
      settings: this.settingsView(settings),
    };
  }

  async listAdvances(tenantId: string, q: AdvanceQueryDto) {
    const settings = await this.getSettings(tenantId);
    const today = await this.today(tenantId);
    const rows = await this.loadApprovedRows(this.prisma, tenantId);
    const key = q.recipientUserId
      ? `u:${q.recipientUserId}`
      : q.payeeId
        ? `p:${q.payeeId}`
        : null;
    const status = q.status ?? 'open';
    const advances = computeAdvances(rows, settings.overdueDays, today)
      .filter((a) => (key ? a.recipientKey === key : true))
      .filter((a) =>
        status === 'all'
          ? true
          : status === 'overdue'
            ? a.overdue
            : a.outstandingPaise > 0,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    const entries = await this.prisma.pettyCashEntry.findMany({
      where: { tenantId, id: { in: advances.map((a) => a.id) } },
      include: entryInclude,
    });
    const byId = new Map(entries.map((e) => [e.id, e]));
    return advances.map((a) => this.advanceView(a, byId.get(a.id)));
  }

  async statement(tenantId: string, q: StatementQueryDto) {
    if (!!q.recipientUserId === !!q.payeeId)
      throw new BadRequestException(t.statementTarget);
    const settings = await this.getSettings(tenantId);
    const today = await this.today(tenantId);

    let recipient: {
      kind: 'user' | 'payee';
      id: string;
      name: string;
      payeeType?: string;
      role?: string;
    };
    if (q.recipientUserId) {
      const u = await this.prisma.user.findFirst({
        where: {
          id: q.recipientUserId,
          tenantId,
          role: { in: [Role.teacher, Role.admin, Role.accounts] },
        },
        select: { id: true, name: true, role: true },
      });
      if (!u) throw new NotFoundException(t.staffNotFound);
      recipient = { kind: 'user', id: u.id, name: u.name, role: u.role };
    } else {
      const p = await this.prisma.pettyCashPayee.findFirst({
        where: { id: q.payeeId, tenantId },
        select: { id: true, name: true, type: true },
      });
      if (!p) throw new NotFoundException(t.payeeNotFoundAny);
      recipient = { kind: 'payee', id: p.id, name: p.name, payeeType: p.type };
    }

    const disbursements = await this.prisma.pettyCashEntry.findMany({
      where: {
        tenantId,
        type: 'DISBURSEMENT',
        status: { in: ['APPROVED', 'PENDING'] },
        ...(q.recipientUserId
          ? { recipientUserId: q.recipientUserId }
          : { payeeId: q.payeeId }),
      },
      include: {
        ...entryInclude,
        settlements: {
          where: { status: { in: ['APPROVED', 'PENDING'] } },
          orderBy: { date: 'asc' },
        },
      },
      orderBy: { date: 'asc' },
    });

    const approvedRows: LedgerRow[] = disbursements.flatMap((d) => {
      const rows: LedgerRow[] = [];
      if (d.status === 'APPROVED')
        rows.push({
          id: d.id,
          type: 'DISBURSEMENT',
          amountPaise: toPaise(d.amount),
          date: fromDbDate(d.date),
          settlesEntryId: null,
          recipientKey: recipientKeyOf(d),
        });
      for (const s of d.settlements.filter((x) => x.status === 'APPROVED'))
        rows.push({
          id: s.id,
          type: s.type,
          amountPaise: toPaise(s.amount),
          date: fromDbDate(s.date),
          settlesEntryId: d.id,
          recipientKey: null,
        });
      return rows;
    });
    const adv = new Map(
      computeAdvances(approvedRows, settings.overdueDays, today).map((a) => [
        a.id,
        a,
      ]),
    );

    const advances = disbursements.map((d) => {
      const a = adv.get(d.id);
      return {
        id: d.id,
        date: fromDbDate(d.date),
        amount: fromPaise(toPaise(d.amount)),
        status: d.status,
        description: d.description,
        settled: fromPaise(a?.settledPaise ?? 0),
        outstanding: fromPaise(a ? a.outstandingPaise : 0),
        overdue: a?.overdue ?? false,
        settlements: d.settlements.map((s) => ({
          id: s.id,
          type: s.type,
          amount: fromPaise(toPaise(s.amount)),
          date: fromDbDate(s.date),
          status: s.status,
          description: s.description,
        })),
      };
    });
    const list = [...adv.values()];
    return {
      recipient,
      totals: {
        disbursed: fromPaise(list.reduce((s, a) => s + a.amountPaise, 0)),
        settled: fromPaise(list.reduce((s, a) => s + a.settledPaise, 0)),
        outstanding: fromPaise(
          list.reduce((s, a) => s + a.outstandingPaise, 0),
        ),
        overdueOutstanding: fromPaise(
          list
            .filter((a) => a.overdue)
            .reduce((s, a) => s + a.outstandingPaise, 0),
        ),
        overdueCount: list.filter((a) => a.overdue).length,
      },
      advances,
    };
  }

  // ── categories ────────────────────────────────────────────────────────────

  async listCategories(tenantId: string, includeInactive = false) {
    await this.getSettings(tenantId);
    // Categories are only ever deactivated, never deleted, so a school with
    // none at all is missing its defaults even if they were marked as created.
    if (
      (await this.prisma.pettyCashCategory.count({ where: { tenantId } })) === 0
    ) {
      await this.prisma.pettyCashCategory.createMany({
        data: DEFAULT_CATEGORIES.map((name) => ({ tenantId, name })),
        skipDuplicates: true,
      });
    }
    const rows = await this.prisma.pettyCashCategory.findMany({
      where: { tenantId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: 'asc' },
    });
    return rows.map(this.categoryView);
  }

  async createCategory(
    tenantId: string,
    dto: CreateCategoryDto,
    user: ActiveUser,
  ) {
    await this.getSettings(tenantId);
    try {
      const row = await this.prisma.pettyCashCategory.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          monthlyBudget:
            dto.monthlyBudget === undefined
              ? null
              : fromPaise(toPaise(dto.monthlyBudget)),
        },
      });
      await this.audit(
        this.prisma,
        tenantId,
        user.id,
        'petty_cash.category.create',
        'petty_cash_category',
        row.id,
        {
          name: row.name,
          monthlyBudget: dto.monthlyBudget ?? null,
        },
      );
      return this.categoryView(row);
    } catch (e) {
      this.rethrowUnique(e, 'CATEGORY_EXISTS', t.categoryExists);
    }
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdateCategoryDto,
    user: ActiveUser,
  ) {
    const existing = await this.prisma.pettyCashCategory.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(t.categoryNotFound);
    try {
      const row = await this.prisma.pettyCashCategory.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.monthlyBudget !== undefined && {
            monthlyBudget:
              dto.monthlyBudget === null
                ? null
                : fromPaise(toPaise(dto.monthlyBudget)),
          }),
        },
      });
      await this.audit(
        this.prisma,
        tenantId,
        user.id,
        'petty_cash.category.update',
        'petty_cash_category',
        id,
        {
          before: this.categoryView(existing),
          after: this.categoryView(row),
        },
      );
      return this.categoryView(row);
    } catch (e) {
      this.rethrowUnique(e, 'CATEGORY_EXISTS', t.categoryExists);
    }
  }

  /** Hard delete only while no entry uses the category; otherwise deactivate. */
  async deleteCategory(tenantId: string, id: string, user: ActiveUser) {
    const existing = await this.prisma.pettyCashCategory.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(t.categoryNotFound);
    const used = await this.prisma.pettyCashEntry.count({
      where: { tenantId, categoryId: id },
    });
    if (used > 0) fail(ConflictException, 'CATEGORY_IN_USE', t.categoryInUse);
    await this.prisma.pettyCashCategory.delete({ where: { id } });
    await this.audit(
      this.prisma,
      tenantId,
      user.id,
      'petty_cash.category.delete',
      'petty_cash_category',
      id,
      {
        name: existing.name,
      },
    );
  }

  private categoryView = (c: {
    id: string;
    name: string;
    monthlyBudget: Prisma.Decimal | null;
    isActive: boolean;
  }) => ({
    id: c.id,
    name: c.name,
    monthlyBudget:
      c.monthlyBudget === null ? null : fromPaise(toPaise(c.monthlyBudget)),
    isActive: c.isActive,
  });

  // ── payees and staff ──────────────────────────────────────────────────────

  async listPayees(
    tenantId: string,
    q: {
      type?: 'VENDOR' | 'GROUND_STAFF';
      includeInactive?: boolean;
      search?: string;
    },
  ) {
    const rows = await this.prisma.pettyCashPayee.findMany({
      where: {
        tenantId,
        ...(q.includeInactive ? {} : { isActive: true }),
        ...(q.type && { type: q.type }),
        ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(this.payeeView);
  }

  async createPayee(tenantId: string, dto: CreatePayeeDto, user: ActiveUser) {
    const row = await this.prisma.pettyCashPayee.create({
      data: {
        tenantId,
        type: dto.type,
        name: dto.name.trim(),
        phone: dto.phone ?? null,
        notes: dto.notes?.trim() || null,
      },
    });
    await this.audit(
      this.prisma,
      tenantId,
      user.id,
      'petty_cash.payee.create',
      'petty_cash_payee',
      row.id,
      {
        type: row.type,
        name: row.name,
      },
    );
    return this.payeeView(row);
  }

  async updatePayee(
    tenantId: string,
    id: string,
    dto: UpdatePayeeDto,
    user: ActiveUser,
  ) {
    const existing = await this.prisma.pettyCashPayee.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(t.payeeNotFoundAny);
    const row = await this.prisma.pettyCashPayee.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && {
          notes: dto.notes === null ? null : dto.notes.trim() || null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await this.audit(
      this.prisma,
      tenantId,
      user.id,
      'petty_cash.payee.update',
      'petty_cash_payee',
      id,
      {
        before: this.payeeView(existing),
        after: this.payeeView(row),
      },
    );
    return this.payeeView(row);
  }

  private payeeView = (p: {
    id: string;
    type: string;
    name: string;
    phone: string | null;
    notes: string | null;
    isActive: boolean;
  }) => ({
    id: p.id,
    type: p.type,
    name: p.name,
    phone: p.phone,
    notes: p.notes,
    isActive: p.isActive,
  });

  /** Staff who can receive cash: teacher, admin and accounts users of this school only. */
  async listStaff(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [Role.teacher, Role.admin, Role.accounts] },
      },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── forecast inputs (used by the forecast service) ───────────────────────

  async forecastSnapshot(tenantId: string) {
    const settings = await this.getSettings(tenantId);
    const today = await this.today(tenantId);
    const [rows, categories, expenses, disbursements] = await Promise.all([
      this.loadApprovedRows(this.prisma, tenantId),
      this.prisma.pettyCashCategory.findMany({ where: { tenantId } }),
      this.prisma.pettyCashEntry.findMany({
        where: { tenantId, status: 'APPROVED', type: 'EXPENSE' },
        select: { id: true, amount: true, date: true, categoryId: true },
      }),
      this.prisma.pettyCashEntry.findMany({
        where: { tenantId, status: 'APPROVED', type: 'DISBURSEMENT' },
        select: {
          id: true,
          recipientUserId: true,
          payeeId: true,
          recipientUser: { select: { name: true } },
          payee: { select: { name: true } },
        },
      }),
    ]);
    const names = new Map(
      disbursements.map((d) => [
        d.id,
        d.recipientUser?.name ?? d.payee?.name ?? '',
      ]),
    );
    const lastSettled = new Map<string, string>();
    for (const r of rows) {
      if (
        r.settlesEntryId &&
        (!lastSettled.has(r.settlesEntryId) ||
          r.date > lastSettled.get(r.settlesEntryId)!)
      )
        lastSettled.set(r.settlesEntryId, r.date);
    }
    return {
      today,
      settings,
      balancePaise: computeBalance(rows),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        budgetPaise: c.monthlyBudget === null ? null : toPaise(c.monthlyBudget),
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        date: fromDbDate(e.date),
        amountPaise: toPaise(e.amount),
        categoryId: e.categoryId,
      })),
      advances: computeAdvances(rows, settings.overdueDays, today)
        .filter((a) => a.recipientKey)
        .map((a) => ({
          id: a.id,
          recipientKey: a.recipientKey as string,
          recipientName: names.get(a.id) ?? '',
          date: a.date,
          amountPaise: a.amountPaise,
          outstandingPaise: a.outstandingPaise,
          lastSettledDate: lastSettled.get(a.id) ?? null,
        })),
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Serialises float-changing writes per school so two clerks cannot overdraw the float together. */
  private locked<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
      return fn(tx);
    });
  }

  async tenantLanguage(tenantId: string): Promise<string | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultLanguage: true },
    });
    return t?.defaultLanguage ?? null;
  }

  private async today(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return todayIn(tenant?.timezone || 'Asia/Kolkata');
  }

  private async assertDate(tenantId: string, ymd: string) {
    if (!isValidYmd(ymd)) throw new BadRequestException(t.invalidDate);
    if (ymd > (await this.today(tenantId)))
      throw new BadRequestException(t.futureDate);
  }

  private assertApprover(user: ActiveUser) {
    if (!isApprover(user.role))
      fail(ForbiddenException, 'APPROVER_ONLY', t.approverOnly);
  }

  /** Request-shape rules that need no database. */
  private assertShape(
    dto: CreateEntryDto,
    amountPaise: number,
    s: PettyCashSettings,
    tenantId: string,
  ) {
    const hasUser = !!dto.recipientUserId;
    const hasPayee = !!dto.payeeId;
    if (hasUser && hasPayee)
      fail(BadRequestException, 'RECIPIENT_EXACTLY_ONE', t.recipientExactlyOne);
    if (
      dto.type !== 'DISBURSEMENT' &&
      dto.type !== 'EXPENSE' &&
      (hasUser || hasPayee)
    )
      fail(BadRequestException, 'RECIPIENT_NOT_ALLOWED', t.recipientNotAllowed);
    if (dto.settlesEntryId && (hasUser || hasPayee))
      fail(BadRequestException, 'RECIPIENT_NOT_ALLOWED', t.recipientNotAllowed);

    switch (dto.type) {
      case 'DISBURSEMENT':
        if (!hasUser && !hasPayee)
          fail(BadRequestException, 'RECIPIENT_REQUIRED', t.recipientRequired);
        if (dto.settlesEntryId)
          fail(BadRequestException, 'SETTLES_NOT_ALLOWED', t.settlesNotAllowed);
        break;
      case 'EXPENSE':
        if (!dto.categoryId)
          fail(BadRequestException, 'CATEGORY_REQUIRED', t.categoryRequired);
        break;
      case 'RETURN':
        if (!dto.settlesEntryId)
          fail(BadRequestException, 'SETTLES_REQUIRED', t.settlesRequired);
        break;
      case 'TOP_UP':
        if (dto.settlesEntryId)
          fail(BadRequestException, 'SETTLES_NOT_ALLOWED', t.settlesNotAllowed);
        break;
    }
    if (dto.categoryId && dto.type !== 'EXPENSE' && dto.type !== 'DISBURSEMENT')
      fail(BadRequestException, 'CATEGORY_NOT_ALLOWED', t.categoryNotAllowed);

    if (
      dto.receiptKey &&
      !dto.receiptKey.startsWith(`private/${tenantId}/petty-cash/`)
    )
      fail(BadRequestException, 'RECEIPT_KEY_INVALID', t.receiptKeyInvalid);
    if (
      dto.type === 'EXPENSE' &&
      amountPaise > s.receiptAbovePaise &&
      !dto.receiptKey
    )
      fail(BadRequestException, 'RECEIPT_REQUIRED', t.receiptRequired);
  }

  /** Referenced category / staff user / payee must exist in this school (and be active). */
  private async assertRefs(db: Db, tenantId: string, dto: CreateEntryDto) {
    if (dto.categoryId) {
      const c = await db.pettyCashCategory.findFirst({
        where: { id: dto.categoryId, tenantId, isActive: true },
      });
      if (!c) fail(NotFoundException, 'CATEGORY_NOT_FOUND', t.categoryNotFound);
    }
    if (dto.recipientUserId) {
      const u = await db.user.findFirst({
        where: {
          id: dto.recipientUserId,
          tenantId,
          role: { in: [Role.teacher, Role.admin, Role.accounts] },
        },
        select: { id: true },
      });
      if (!u) fail(NotFoundException, 'STAFF_NOT_FOUND', t.staffNotFound);
    }
    if (dto.payeeId) {
      const p = await db.pettyCashPayee.findFirst({
        where: { id: dto.payeeId, tenantId, isActive: true },
      });
      if (!p) fail(NotFoundException, 'PAYEE_NOT_FOUND', t.payeeNotFound);
    }
  }

  /**
   * Whether an entry may take effect against the current APPROVED ledger:
   * its target disbursement exists, is not over-settled, and the float stays >= 0.
   */
  private assertApplicable(
    e: {
      type: PettyCashEntryType;
      amountPaise: number;
      settlesEntryId: string | null;
    },
    rows: ApprovedRow[],
    date: string,
    checkFloat = true,
  ) {
    if (e.settlesEntryId) {
      const target = rows.find(
        (r) => r.id === e.settlesEntryId && r.type === 'DISBURSEMENT',
      );
      if (!target)
        fail(NotFoundException, 'SETTLES_NOT_FOUND', t.settlesNotFound);
      if (date < target!.date)
        fail(
          BadRequestException,
          'SETTLE_BEFORE_DISBURSEMENT',
          t.settleBeforeDisbursement,
        );
      if (e.amountPaise > outstandingOn(e.settlesEntryId, rows))
        fail(BadRequestException, 'OVER_SETTLE', t.overSettle);
    }
    if (
      checkFloat &&
      reducesFloat(e.type, e.settlesEntryId) &&
      computeBalance(rows) - e.amountPaise < 0
    )
      fail(ConflictException, 'INSUFFICIENT_FLOAT', t.insufficientFloat);
  }

  private async loadApprovedRows(
    db: Db,
    tenantId: string,
  ): Promise<ApprovedRow[]> {
    const rows = await db.pettyCashEntry.findMany({
      where: { tenantId, status: 'APPROVED' },
      select: {
        id: true,
        type: true,
        amount: true,
        date: true,
        settlesEntryId: true,
        recipientUserId: true,
        payeeId: true,
        categoryId: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountPaise: toPaise(r.amount),
      date: fromDbDate(r.date),
      settlesEntryId: r.settlesEntryId,
      recipientKey: recipientKeyOf(r),
      categoryId: r.categoryId,
    }));
  }

  private entryWhere(
    tenantId: string,
    q: EntryQueryDto,
  ): Prisma.PettyCashEntryWhereInput {
    if (q.from && !isValidYmd(q.from))
      throw new BadRequestException(t.invalidDate);
    if (q.to && !isValidYmd(q.to)) throw new BadRequestException(t.invalidDate);
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException(t.rangeReversed);
    return {
      tenantId,
      ...((q.from || q.to) && {
        date: {
          ...(q.from && { gte: toDbDate(q.from) }),
          ...(q.to && { lte: toDbDate(q.to) }),
        },
      }),
      ...(q.type && { type: q.type }),
      ...(q.status && { status: q.status }),
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.recipientUserId && { recipientUserId: q.recipientUserId }),
      ...(q.payeeId && { payeeId: q.payeeId }),
    };
  }

  private advanceView(a: Advance, e?: EntryRow) {
    return {
      id: a.id,
      date: a.date,
      amount: fromPaise(a.amountPaise),
      settled: fromPaise(a.settledPaise),
      outstanding: fromPaise(a.outstandingPaise),
      ageDays: a.ageDays,
      overdue: a.overdue,
      description: e?.description ?? '',
      category: e?.category ?? null,
      recipient: e ? this.recipientView(e) : null,
    };
  }

  private recipientView(e: EntryRow) {
    if (e.recipientUser)
      return {
        kind: 'user' as const,
        id: e.recipientUser.id,
        name: e.recipientUser.name,
        role: e.recipientUser.role,
      };
    if (e.payee)
      return {
        kind: 'payee' as const,
        id: e.payee.id,
        name: e.payee.name,
        payeeType: e.payee.type,
      };
    return null;
  }

  private async toViews(rows: EntryRow[]) {
    const ids = [
      ...new Set(
        rows.flatMap((r) =>
          [r.createdBy, r.approvedBy, r.voidedBy].filter(
            (x): x is string => !!x,
          ),
        ),
      ),
    ];
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const name = new Map(users.map((u) => [u.id, u.name]));
    const person = (id: string | null) =>
      id ? { id, name: name.get(id) ?? '' } : null;
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      amount: fromPaise(toPaise(r.amount)),
      date: fromDbDate(r.date),
      category: r.category,
      description: r.description,
      hasReceipt: !!r.receiptKey,
      recipient: this.recipientView(r),
      settlesEntryId: r.settlesEntryId,
      createdBy: person(r.createdBy) as { id: string; name: string },
      createdAt: r.createdAt,
      /** Whoever approved or rejected it (absent for entries at/below the threshold). */
      reviewedBy: person(r.approvedBy),
      reviewedAt: r.approvedAt,
      rejectionReason: r.rejectionReason,
      voidReason: r.voidReason,
      voidedBy: person(r.voidedBy),
      voidedAt: r.voidedAt,
    }));
  }

  private rethrowUnique(e: unknown, code: string, message: string): never {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')
      throw new ConflictException({ code, message });
    throw e;
  }

  private audit(
    db: Db,
    tenantId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    diff: Prisma.InputJsonValue,
  ) {
    return db.auditLog.create({
      data: { tenantId, actorId, action, entityType, entityId, diff },
    });
  }
}
