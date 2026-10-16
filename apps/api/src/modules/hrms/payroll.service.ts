import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeStatus,
  PayItemKind,
  PayItemSource,
  PayRunStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { fromDbDate, toDbDate } from '../attendance/attendance-dates';
import {
  AdjustmentDto,
  CreateStructureDto,
  GeneratePayRunDto,
  PayRunQueryDto,
} from './dto/hrms.dto';
import { computePeriod } from './attendance.math';
import { HrCrypto } from './hr-crypto.service';
import { HrSettings, HrSettingsService } from './hr-settings.service';
import { loadHolidays } from './hrms-calendar';
import { isMonth, monthBounds } from './hrms-dates';
import {
  BANK_CSV_HEADERS,
  REGISTER_CSV_HEADERS,
  hrmsStrings as t,
} from './hrms.strings';
import {
  Db,
  audit,
  csvLine,
  fail,
  isApprover,
  todayFor,
  withLock,
} from './hrms.shared';
import { PayslipInput, buildPayslipPdf, monthLabel } from './payslip-pdf';
import {
  Adjustment,
  PayLineResult,
  StructureComponent,
  StructureInput,
  componentPaise,
  computePayLine,
  fromPaise,
  toPaise,
  totalsOf,
} from './payroll.math';
import { StaffAttendanceService } from './staff-attendance.service';

const RESERVED_NAMES = new Set([
  'basic',
  'pf',
  'esi',
  'pt',
  'provident fund',
  'professional tax',
  'epf',
]);

const lineInclude = {
  items: { orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.PayRunLineInclude;

type LineRow = Prisma.PayRunLineGetPayload<{ include: typeof lineInclude }>;

const money = (d: { toString(): string }) => fromPaise(toPaise(d));

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: HrSettingsService,
    private readonly attendance: StaffAttendanceService,
    private readonly crypto: HrCrypto,
  ) {}

  // ── salary structures ─────────────────────────────────────────────────────

  private structureView(s: Prisma.SalaryStructureGetPayload<object>) {
    const comps = (s.components ?? []) as unknown as StructureComponent[];
    const basicPaise = toPaise(s.basic);
    const earnings = comps
      .filter((c) => c.kind === 'EARNING')
      .reduce((sum, c) => sum + componentPaise(c, basicPaise), 0);
    return {
      id: s.id,
      employeeId: s.employeeId,
      effectiveFrom: fromDbDate(s.effectiveFrom),
      basic: money(s.basic),
      components: comps.map((c) => ({
        name: c.name,
        kind: c.kind,
        calc: c.calc,
        amount: c.calc === 'FIXED' ? fromPaise(c.amountPaise ?? 0) : null,
        percent:
          c.calc === 'PERCENT_OF_BASIC' ? (c.percentBp ?? 0) / 100 : null,
      })),
      pfApplicable: s.pfApplicable,
      esiApplicable: s.esiApplicable,
      ptApplicable: s.ptApplicable,
      monthlyGross: fromPaise(basicPaise + earnings),
      createdAt: s.createdAt.toISOString(),
    };
  }

  structureInput(s: Prisma.SalaryStructureGetPayload<object>): StructureInput {
    return {
      basicPaise: toPaise(s.basic),
      components: (s.components ?? []) as unknown as StructureComponent[],
      pfApplicable: s.pfApplicable,
      esiApplicable: s.esiApplicable,
      ptApplicable: s.ptApplicable,
    };
  }

  async createStructure(
    tenantId: string,
    user: ActiveUser,
    dto: CreateStructureDto,
  ) {
    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId },
      select: { id: true },
    });
    if (!emp) throw new NotFoundException(t.employeeNotFound);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dto.effectiveFrom) ||
      Number.isNaN(toDbDate(dto.effectiveFrom).getTime())
    )
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const names = new Set<string>();
    const components: StructureComponent[] = dto.components.map((c) => {
      const key = c.name.trim().toLowerCase();
      if (!key || RESERVED_NAMES.has(key) || names.has(key))
        fail(
          BadRequestException,
          'COMPONENT_INVALID',
          t.structureComponentInvalid,
        );
      names.add(key);
      if (c.calc === 'FIXED') {
        if (c.amount === undefined)
          fail(
            BadRequestException,
            'COMPONENT_INVALID',
            t.structureComponentInvalid,
          );
        return {
          name: c.name,
          kind: c.kind,
          calc: 'FIXED' as const,
          amountPaise: toPaise(c.amount as number),
        };
      }
      if (c.percent === undefined)
        fail(
          BadRequestException,
          'COMPONENT_INVALID',
          t.structureComponentInvalid,
        );
      return {
        name: c.name,
        kind: c.kind,
        calc: 'PERCENT_OF_BASIC' as const,
        percentBp: Math.round((c.percent as number) * 100),
      };
    });
    const dup = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId: dto.employeeId,
        effectiveFrom: toDbDate(dto.effectiveFrom),
      },
      select: { id: true },
    });
    if (dup)
      fail(ConflictException, 'STRUCTURE_DUPLICATE', t.structureDuplicate);
    const row = await this.prisma.salaryStructure.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        effectiveFrom: toDbDate(dto.effectiveFrom),
        basic: fromPaise(toPaise(dto.basic)),
        components: components as unknown as Prisma.InputJsonValue,
        pfApplicable: dto.pfApplicable,
        esiApplicable: dto.esiApplicable,
        ptApplicable: dto.ptApplicable,
        createdBy: user.id,
      },
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.structure.create',
      'salary_structure',
      row.id,
      {
        employeeId: dto.employeeId,
        effectiveFrom: dto.effectiveFrom,
        basic: fromPaise(toPaise(dto.basic)),
        componentCount: components.length,
      },
    );
    return this.structureView(row);
  }

  async listStructures(tenantId: string, employeeId?: string) {
    const rows = await this.prisma.salaryStructure.findMany({
      where: { tenantId, ...(employeeId && { employeeId }) },
      orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return rows.map((r) => this.structureView(r));
  }

  /** Each active employee with the structure in force today (or none). */
  async coverage(tenantId: string) {
    const today = await todayFor(this.prisma, tenantId);
    const emps = await this.prisma.employee.findMany({
      where: { tenantId, status: EmployeeStatus.ACTIVE },
      orderBy: { name: 'asc' },
      select: { id: true, employeeCode: true, name: true, designation: true },
    });
    const structs = await this.prisma.salaryStructure.findMany({
      where: { tenantId, effectiveFrom: { lte: toDbDate(today) } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const latest = new Map<string, (typeof structs)[number]>();
    for (const s of structs)
      if (!latest.has(s.employeeId)) latest.set(s.employeeId, s);
    return emps.map((e) => ({
      employeeId: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      designation: e.designation,
      current: latest.has(e.id) ? this.structureView(latest.get(e.id)!) : null,
    }));
  }

  // ── pay runs ──────────────────────────────────────────────────────────────

  private runView(
    r: Prisma.PayRunGetPayload<object>,
    totals?: {
      employees: number;
      gross: string;
      deductions: string;
      net: string;
    },
  ) {
    return {
      id: r.id,
      month: r.month,
      status: r.status,
      preparedBy: r.preparedBy,
      submittedAt: r.submittedAt?.toISOString() ?? null,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      selfApproved: r.selfApproved,
      lockedAt: r.lockedAt?.toISOString() ?? null,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      cancelReason: r.cancelReason,
      paidAt: r.paidAt?.toISOString() ?? null,
      paymentReference: r.paymentReference,
      createdAt: r.createdAt.toISOString(),
      totals: totals ?? null,
    };
  }

  async list(tenantId: string, q: PayRunQueryDto) {
    const rows = await this.prisma.payRun.findMany({
      where: {
        tenantId,
        ...(q.status && { status: q.status }),
        ...(q.year && { month: { startsWith: `${q.year}-` } }),
      },
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    });
    const sums = await this.prisma.payRunLine.groupBy({
      by: ['payRunId'],
      where: { tenantId, payRunId: { in: rows.map((r) => r.id) } },
      _sum: { grossEarnings: true, totalDeductions: true, netPay: true },
      _count: { _all: true },
    });
    const byRun = new Map(sums.map((s) => [s.payRunId, s]));
    return rows.map((r) => {
      const s = byRun.get(r.id);
      return this.runView(r, {
        employees: s?._count._all ?? 0,
        gross: money(s?._sum.grossEarnings ?? 0),
        deductions: money(s?._sum.totalDeductions ?? 0),
        net: money(s?._sum.netPay ?? 0),
      });
    });
  }

  private lineSummary(l: LineRow | Prisma.PayRunLineGetPayload<object>) {
    return {
      id: l.id,
      employeeId: l.employeeId,
      employeeCode: l.employeeCode,
      employeeName: l.employeeName,
      designation: l.designation,
      department: l.department,
      periodDays: l.periodDays,
      lopDays: Number(l.lopDays.toString()),
      paidDays: Number(l.paidDays.toString()),
      gross: money(l.grossEarnings),
      deductions: money(l.totalDeductions),
      net: money(l.netPay),
      flags: l.flags,
    };
  }

  private lineView(l: LineRow) {
    return {
      ...this.lineSummary(l),
      unmarkedDays: l.unmarkedDays,
      employerPf: money(l.employerPf),
      employerEsi: money(l.employerEsi),
      items: l.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        source: i.source,
        code: i.code,
        name: i.name,
        amount: money(i.amount),
        reason: i.reason,
      })),
    };
  }

  async get(tenantId: string, id: string) {
    const run = await this.loadRun(this.prisma, tenantId, id);
    const lines = await this.prisma.payRunLine.findMany({
      where: { payRunId: id, tenantId },
      orderBy: { employeeName: 'asc' },
    });
    const sum = (f: (l: (typeof lines)[number]) => Prisma.Decimal) =>
      lines.reduce((s, l) => s + toPaise(f(l)), 0);
    return {
      ...this.runView(run, {
        employees: lines.length,
        gross: fromPaise(sum((l) => l.grossEarnings)),
        deductions: fromPaise(sum((l) => l.totalDeductions)),
        net: fromPaise(sum((l) => l.netPay)),
      }),
      settings: run.settingsSnapshot,
      lines: lines.map((l) => this.lineSummary(l)),
    };
  }

  async getLine(tenantId: string, runId: string, lineId: string) {
    return this.lineView(
      await this.loadLine(this.prisma, tenantId, runId, lineId),
    );
  }

  private async loadRun(db: Db, tenantId: string, id: string) {
    const run = await db.payRun.findFirst({ where: { id, tenantId } });
    if (!run) throw new NotFoundException(t.payRunNotFound);
    return run;
  }

  private async loadLine(
    db: Db,
    tenantId: string,
    runId: string,
    lineId: string,
  ) {
    const line = await db.payRunLine.findFirst({
      where: { id: lineId, payRunId: runId, tenantId },
      include: lineInclude,
    });
    if (!line) throw new NotFoundException(t.lineNotFound);
    return line;
  }

  /** Build and insert lines for [month]; adjustments (by employee) are re-applied on regenerate. */
  private async buildLines(
    tx: Prisma.TransactionClient,
    tenantId: string,
    runId: string,
    month: string,
    s: HrSettings,
    adjustments: Map<string, Adjustment[]>,
  ) {
    const { from, to } = monthBounds(month);
    const employees = await tx.employee.findMany({
      where: {
        tenantId,
        joinDate: { lte: toDbDate(to) },
        OR: [
          { status: EmployeeStatus.ACTIVE },
          { exitDate: { gte: toDbDate(from) } },
        ],
      },
      orderBy: { name: 'asc' },
    });
    const structs = await tx.salaryStructure.findMany({
      where: {
        tenantId,
        employeeId: { in: employees.map((e) => e.id) },
        effectiveFrom: { lte: toDbDate(to) },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    const structFor = new Map<string, (typeof structs)[number]>();
    for (const st of structs)
      if (!structFor.has(st.employeeId)) structFor.set(st.employeeId, st);

    const holidays = await loadHolidays(tx, tenantId, from, to);
    const holidaySet = new Set(holidays.keys());
    const records = await this.attendance.recordsFor(
      tx,
      tenantId,
      employees.map((e) => e.id),
      from,
      to,
    );

    const skipped: { employeeId: string; name: string }[] = [];
    let created = 0;
    for (const e of employees) {
      const st = structFor.get(e.id);
      if (!st) {
        skipped.push({ employeeId: e.id, name: e.name });
        continue;
      }
      const period = computePeriod({
        month,
        rule: s.workingDaysRule,
        weeklyOff: s.weeklyOffDays,
        holidays: holidaySet,
        records: records.get(e.id) ?? new Map(),
        treatUnmarkedAsAbsent: s.treatUnmarkedAsAbsent,
        joinDate: fromDbDate(e.joinDate),
        exitDate: e.exitDate ? fromDbDate(e.exitDate) : null,
      });
      const calc = computePayLine({
        structure: this.structureInput(st),
        statutory: s.statutory,
        month,
        periodDays: period.periodDays,
        lopTenths: period.lopTenths,
        adjustments: adjustments.get(e.id),
      });
      const flags = [...calc.flags];
      if (period.unmarkedDays > 0) flags.push('UNMARKED_DAYS');
      if (!e.bankAccountEnc || !e.bankIfscEnc) flags.push('NO_BANK_DETAILS');
      await this.insertLine(tx, tenantId, runId, e, st.id, period, calc, flags);
      created++;
    }
    return { created, skipped };
  }

  private insertLine(
    tx: Prisma.TransactionClient,
    tenantId: string,
    runId: string,
    e: Prisma.EmployeeGetPayload<object>,
    structureId: string,
    period: { periodDays: number; lopTenths: number; unmarkedDays: number },
    calc: PayLineResult,
    flags: string[],
  ) {
    return tx.payRunLine.create({
      data: {
        tenantId,
        payRunId: runId,
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: e.name,
        designation: e.designation,
        department: e.department,
        structureId,
        periodDays: period.periodDays,
        lopDays: period.lopTenths / 10,
        paidDays: calc.paidTenths / 10,
        unmarkedDays: period.unmarkedDays,
        grossEarnings: fromPaise(calc.grossPaise),
        totalDeductions: fromPaise(calc.deductionsPaise),
        netPay: fromPaise(calc.netPaise),
        employerPf: fromPaise(calc.employerPfPaise),
        employerEsi: fromPaise(calc.employerEsiPaise),
        flags,
        bankAccountEnc: e.bankAccountEnc,
        bankIfscEnc: e.bankIfscEnc,
        bankHolderEnc: e.bankHolderEnc,
        items: {
          create: calc.items.map((i) => ({
            tenantId,
            kind: i.kind,
            source: i.source,
            code: i.code,
            name: i.name,
            amount: fromPaise(i.amountPaise),
            reason: i.reason ?? null,
          })),
        },
      },
    });
  }

  /** One non-cancelled run per month: advisory lock + check (and a partial unique index as the backstop). */
  async generate(tenantId: string, user: ActiveUser, dto: GeneratePayRunDto) {
    if (!isMonth(dto.month))
      fail(BadRequestException, 'MONTH_INVALID', t.monthInvalid);
    const today = await todayFor(this.prisma, tenantId);
    if (monthBounds(dto.month).from > today)
      fail(BadRequestException, 'FUTURE_MONTH', t.futureMonth);
    const s = await this.settings.get(tenantId);
    const result = await withLock(
      this.prisma,
      tenantId,
      'payrun',
      async (tx) => {
        const existing = await tx.payRun.findFirst({
          where: {
            tenantId,
            month: dto.month,
            status: { not: PayRunStatus.CANCELLED },
          },
          select: { id: true },
        });
        if (existing)
          throw new ConflictException({
            code: 'PAY_RUN_EXISTS',
            message: t.payRunMonthExists,
            payRunId: existing.id,
          });
        const run = await tx.payRun.create({
          data: {
            tenantId,
            month: dto.month,
            preparedBy: user.id,
            settingsSnapshot: this.settings.view(s),
          },
        });
        const built = await this.buildLines(
          tx,
          tenantId,
          run.id,
          dto.month,
          s,
          new Map(),
        );
        if (built.created === 0)
          fail(BadRequestException, 'PAY_RUN_EMPTY', t.payRunEmpty);
        await audit(
          tx,
          tenantId,
          user.id,
          'hrms.payrun.generate',
          'pay_run',
          run.id,
          {
            month: dto.month,
            employees: built.created,
            skippedNoStructure: built.skipped.length,
          },
        );
        return { run, skipped: built.skipped };
      },
    );
    return {
      ...(await this.get(tenantId, result.run.id)),
      skipped: result.skipped,
    };
  }

  /** Recompute a DRAFT from current attendance, structures and settings; manual adjustments are kept. */
  async regenerate(tenantId: string, user: ActiveUser, id: string) {
    const s = await this.settings.get(tenantId);
    const out = await withLock(this.prisma, tenantId, 'payrun', async (tx) => {
      const run = await this.loadRun(tx, tenantId, id);
      this.assertDraft(run.status);
      const old = await tx.payRunLine.findMany({
        where: { payRunId: id },
        include: { items: { where: { source: PayItemSource.ADJUSTMENT } } },
      });
      const adj = new Map<string, Adjustment[]>();
      for (const l of old) {
        if (l.items.length)
          adj.set(
            l.employeeId,
            l.items.map((i) => ({
              kind: i.kind,
              name: i.name,
              amountPaise: toPaise(i.amount),
              reason: i.reason ?? '',
            })),
          );
      }
      await tx.payRunLine.deleteMany({ where: { payRunId: id } });
      const built = await this.buildLines(tx, tenantId, id, run.month, s, adj);
      if (built.created === 0)
        fail(BadRequestException, 'PAY_RUN_EMPTY', t.payRunEmpty);
      await tx.payRun.update({
        where: { id },
        data: {
          settingsSnapshot: this.settings.view(s),
        },
      });
      await audit(
        tx,
        tenantId,
        user.id,
        'hrms.payrun.regenerate',
        'pay_run',
        id,
        {
          employees: built.created,
          skippedNoStructure: built.skipped.length,
          adjustmentsKept: [...adj.values()].reduce((n, a) => n + a.length, 0),
        },
      );
      return built;
    });
    return { ...(await this.get(tenantId, id)), skipped: out.skipped };
  }

  private assertDraft(status: PayRunStatus) {
    if (status === PayRunStatus.LOCKED)
      fail(ConflictException, 'PAY_RUN_LOCKED', t.payRunLocked);
    if (status !== PayRunStatus.DRAFT)
      fail(ConflictException, 'NOT_DRAFT', t.payRunNotDraft);
  }

  // ── adjustments ───────────────────────────────────────────────────────────

  async addAdjustment(
    tenantId: string,
    user: ActiveUser,
    runId: string,
    lineId: string,
    dto: AdjustmentDto,
  ) {
    const line = await withLock(this.prisma, tenantId, 'payrun', async (tx) => {
      const run = await this.loadRun(tx, tenantId, runId);
      this.assertDraft(run.status);
      const l = await this.loadLine(tx, tenantId, runId, lineId);
      const kind =
        dto.type === 'ALLOWANCE' ? PayItemKind.EARNING : PayItemKind.DEDUCTION;
      const amountPaise = toPaise(dto.amount);
      const next = totalsOf([
        ...l.items.map((i) => ({
          kind: i.kind,
          amountPaise: toPaise(i.amount),
        })),
        { kind, amountPaise },
      ]);
      if (next.netPaise < 0)
        fail(BadRequestException, 'ADJUSTMENT_NEGATIVE', t.adjustmentNegative);
      await tx.payRunLineItem.create({
        data: {
          tenantId,
          lineId,
          kind,
          source: PayItemSource.ADJUSTMENT,
          name: dto.name,
          amount: fromPaise(amountPaise),
          reason: dto.reason,
          createdBy: user.id,
        },
      });
      await tx.payRunLine.update({
        where: { id: lineId },
        data: {
          grossEarnings: fromPaise(next.grossPaise),
          totalDeductions: fromPaise(next.deductionsPaise),
          netPay: fromPaise(next.netPaise),
        },
      });
      await audit(
        tx,
        tenantId,
        user.id,
        'hrms.payrun.adjustment_add',
        'pay_run_line',
        lineId,
        {
          payRunId: runId,
          employeeId: l.employeeId,
          type: dto.type,
          name: dto.name,
          amount: fromPaise(amountPaise),
          reason: dto.reason,
        },
      );
      return this.loadLine(tx, tenantId, runId, lineId);
    });
    return this.lineView(line);
  }

  async removeAdjustment(
    tenantId: string,
    user: ActiveUser,
    runId: string,
    lineId: string,
    itemId: string,
  ) {
    const line = await withLock(this.prisma, tenantId, 'payrun', async (tx) => {
      const run = await this.loadRun(tx, tenantId, runId);
      this.assertDraft(run.status);
      const l = await this.loadLine(tx, tenantId, runId, lineId);
      const item = l.items.find(
        (i) => i.id === itemId && i.source === PayItemSource.ADJUSTMENT,
      );
      if (!item) throw new NotFoundException(t.adjustmentNotFound);
      const rest = l.items.filter((i) => i.id !== itemId);
      const next = totalsOf(
        rest.map((i) => ({ kind: i.kind, amountPaise: toPaise(i.amount) })),
      );
      if (next.netPaise < 0)
        fail(BadRequestException, 'ADJUSTMENT_NEGATIVE', t.adjustmentNegative);
      await tx.payRunLineItem.delete({ where: { id: itemId } });
      await tx.payRunLine.update({
        where: { id: lineId },
        data: {
          grossEarnings: fromPaise(next.grossPaise),
          totalDeductions: fromPaise(next.deductionsPaise),
          netPay: fromPaise(next.netPaise),
        },
      });
      await audit(
        tx,
        tenantId,
        user.id,
        'hrms.payrun.adjustment_remove',
        'pay_run_line',
        lineId,
        {
          payRunId: runId,
          employeeId: l.employeeId,
          name: item.name,
          amount: money(item.amount),
        },
      );
      return this.loadLine(tx, tenantId, runId, lineId);
    });
    return this.lineView(line);
  }

  // ── state machine ─────────────────────────────────────────────────────────

  /**
   * DRAFT -> REVIEW -> APPROVED -> LOCKED; cancel from any state before LOCKED;
   * reopen REVIEW/APPROVED -> DRAFT. Only admin-level users approve and lock.
   * An admin who prepared a run may approve it; that is recorded as selfApproved.
   * Accounts users can never approve, so they cannot approve their own run.
   */
  private async transition(
    tenantId: string,
    user: ActiveUser,
    id: string,
    action: string,
    rule: (run: Prisma.PayRunGetPayload<object>) => {
      to: PayRunStatus;
      data?: Prisma.PayRunUncheckedUpdateInput;
      extra?: Record<string, unknown>;
    },
  ) {
    await withLock(this.prisma, tenantId, 'payrun', async (tx) => {
      const run = await this.loadRun(tx, tenantId, id);
      if (
        run.status === PayRunStatus.LOCKED &&
        action !== 'hrms.payrun.mark_paid'
      )
        fail(ConflictException, 'PAY_RUN_LOCKED', t.payRunLocked);
      const r = rule(run);
      await tx.payRun.update({
        where: { id },
        data: { status: r.to, ...r.data },
      });
      await audit(tx, tenantId, user.id, action, 'pay_run', id, {
        month: run.month,
        from: run.status,
        to: r.to,
        ...r.extra,
      });
    });
    return this.get(tenantId, id);
  }

  async submit(tenantId: string, user: ActiveUser, id: string) {
    return this.transition(tenantId, user, id, 'hrms.payrun.submit', (run) => {
      if (run.status !== PayRunStatus.DRAFT)
        fail(ConflictException, 'BAD_STATE', t.payRunBadState);
      return { to: PayRunStatus.REVIEW, data: { submittedAt: new Date() } };
    });
  }

  async reopen(tenantId: string, user: ActiveUser, id: string) {
    return this.transition(tenantId, user, id, 'hrms.payrun.reopen', (run) => {
      if (run.status === PayRunStatus.APPROVED && !isApprover(user.role))
        fail(ForbiddenException, 'APPROVER_ONLY', t.payRunAdminOnly);
      if (
        run.status !== PayRunStatus.REVIEW &&
        run.status !== PayRunStatus.APPROVED
      )
        fail(ConflictException, 'BAD_STATE', t.payRunBadState);
      return {
        to: PayRunStatus.DRAFT,
        data: {
          submittedAt: null,
          approvedBy: null,
          approvedAt: null,
          selfApproved: false,
        },
      };
    });
  }

  async approve(tenantId: string, user: ActiveUser, id: string) {
    if (!isApprover(user.role))
      fail(ForbiddenException, 'APPROVER_ONLY', t.payRunAdminOnly);
    return this.transition(tenantId, user, id, 'hrms.payrun.approve', (run) => {
      if (run.status !== PayRunStatus.REVIEW)
        fail(ConflictException, 'BAD_STATE', t.payRunBadState);
      const selfApproved = run.preparedBy === user.id;
      return {
        to: PayRunStatus.APPROVED,
        data: { approvedBy: user.id, approvedAt: new Date(), selfApproved },
        extra: { selfApproved, preparedBy: run.preparedBy },
      };
    });
  }

  async lock(tenantId: string, user: ActiveUser, id: string) {
    if (!isApprover(user.role))
      fail(ForbiddenException, 'APPROVER_ONLY', t.payRunAdminOnly);
    return this.transition(tenantId, user, id, 'hrms.payrun.lock', (run) => {
      if (run.status !== PayRunStatus.APPROVED)
        fail(ConflictException, 'BAD_STATE', t.payRunBadState);
      return {
        to: PayRunStatus.LOCKED,
        data: { lockedBy: user.id, lockedAt: new Date() },
      };
    });
  }

  async cancel(tenantId: string, user: ActiveUser, id: string, reason: string) {
    if (!reason?.trim())
      fail(BadRequestException, 'REASON_REQUIRED', t.payRunCancelReason);
    return this.transition(tenantId, user, id, 'hrms.payrun.cancel', (run) => {
      if (run.status === PayRunStatus.CANCELLED)
        fail(ConflictException, 'BAD_STATE', t.payRunBadState);
      return {
        to: PayRunStatus.CANCELLED,
        data: {
          cancelledBy: user.id,
          cancelledAt: new Date(),
          cancelReason: reason.trim(),
        },
        extra: { reason: reason.trim() },
      };
    });
  }

  async markPaid(
    tenantId: string,
    user: ActiveUser,
    id: string,
    reference: string,
  ) {
    return this.transition(
      tenantId,
      user,
      id,
      'hrms.payrun.mark_paid',
      (run) => {
        if (run.status !== PayRunStatus.LOCKED)
          fail(ConflictException, 'NOT_LOCKED', t.payRunNotLocked);
        if (run.paidAt)
          fail(ConflictException, 'ALREADY_PAID', t.payRunAlreadyPaid);
        return {
          to: PayRunStatus.LOCKED,
          data: {
            paidAt: new Date(),
            paidBy: user.id,
            paymentReference: reference.trim(),
          },
          extra: { reference: reference.trim() },
        };
      },
    );
  }

  // ── exports ───────────────────────────────────────────────────────────────

  /** Bank transfer file for a locked run. Decrypts bank details, so every export is audit-logged. */
  async bankCsv(tenantId: string, user: ActiveUser, id: string) {
    const run = await this.loadRun(this.prisma, tenantId, id);
    if (run.status !== PayRunStatus.LOCKED)
      fail(ConflictException, 'NOT_LOCKED', t.payRunNotLocked);
    const lines = await this.prisma.payRunLine.findMany({
      where: { payRunId: id, tenantId },
      orderBy: { employeeName: 'asc' },
    });
    const out = [csvLine([...BANK_CSV_HEADERS])];
    let excluded = 0;
    let total = 0;
    for (const l of lines) {
      const net = toPaise(l.netPay);
      if (net <= 0 || !l.bankAccountEnc || !l.bankIfscEnc) {
        excluded++;
        continue;
      }
      total += net;
      out.push(
        csvLine([
          l.employeeCode,
          l.employeeName,
          l.bankHolderEnc
            ? this.crypto.decrypt(l.bankHolderEnc)
            : l.employeeName,
          this.crypto.decrypt(l.bankAccountEnc),
          this.crypto.decrypt(l.bankIfscEnc),
          fromPaise(net),
          `Salary ${run.month}`,
        ]),
      );
    }
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.payrun.bank_export',
      'pay_run',
      id,
      {
        month: run.month,
        rows: out.length - 1,
        excluded,
        total: fromPaise(total),
      },
    );
    return {
      csv: out.join('\n') + '\n',
      excluded,
      filename: `bank-transfer-${run.month}.csv`,
    };
  }

  async registerCsv(tenantId: string, id: string) {
    const run = await this.loadRun(this.prisma, tenantId, id);
    if (run.status === PayRunStatus.CANCELLED)
      fail(ConflictException, 'BAD_STATE', t.payRunBadState);
    const lines = await this.prisma.payRunLine.findMany({
      where: { payRunId: id, tenantId },
      include: lineInclude,
      orderBy: { employeeName: 'asc' },
    });
    const out = [csvLine([...REGISTER_CSV_HEADERS])];
    for (const l of lines) {
      const code = (c: string) =>
        l.items
          .filter((i) => i.code === c && i.kind === 'DEDUCTION')
          .reduce((s, i) => s + toPaise(i.amount), 0);
      const pf = code('PF');
      const esi = code('ESI');
      const pt = code('PT');
      const total = toPaise(l.totalDeductions);
      out.push(
        csvLine([
          l.employeeCode,
          l.employeeName,
          l.designation,
          l.department,
          l.periodDays,
          Number(l.lopDays.toString()),
          Number(l.paidDays.toString()),
          money(l.grossEarnings),
          fromPaise(pf),
          fromPaise(esi),
          fromPaise(pt),
          fromPaise(total - pf - esi - pt),
          fromPaise(total),
          money(l.netPay),
          money(l.employerPf),
          money(l.employerEsi),
          l.flags.join(' '),
        ]),
      );
    }
    return {
      csv: out.join('\n') + '\n',
      filename: `salary-register-${run.month}.csv`,
    };
  }

  // ── payslips ──────────────────────────────────────────────────────────────

  /** Console: any non-cancelled run (a draft payslip is marked as such). */
  async payslipPdf(tenantId: string, runId: string, lineId: string) {
    const run = await this.loadRun(this.prisma, tenantId, runId);
    if (run.status === PayRunStatus.CANCELLED)
      fail(NotFoundException, 'PAYSLIP_NOT_AVAILABLE', t.payslipNotAvailable);
    const line = await this.loadLine(this.prisma, tenantId, runId, lineId);
    return this.renderPayslip(tenantId, run, line);
  }

  /** Employee self-service: the caller's own employee id is resolved by the caller, never from the request. */
  async ownPayslips(tenantId: string, employeeId: string) {
    const lines = await this.prisma.payRunLine.findMany({
      where: { tenantId, employeeId, payRun: { status: PayRunStatus.LOCKED } },
      include: { payRun: { select: { month: true, paidAt: true } } },
      orderBy: { payRun: { month: 'desc' } },
      take: 60,
    });
    return lines.map((l) => ({
      id: l.id,
      month: l.payRun.month,
      gross: money(l.grossEarnings),
      deductions: money(l.totalDeductions),
      net: money(l.netPay),
      paidAt: l.payRun.paidAt?.toISOString() ?? null,
    }));
  }

  async ownPayslipPdf(tenantId: string, employeeId: string, lineId: string) {
    const line = await this.prisma.payRunLine.findFirst({
      where: {
        id: lineId,
        tenantId,
        employeeId,
        payRun: { status: PayRunStatus.LOCKED },
      },
      include: lineInclude,
    });
    if (!line) throw new NotFoundException(t.payslipNotAvailable);
    const run = await this.loadRun(this.prisma, tenantId, line.payRunId);
    return this.renderPayslip(tenantId, run, line);
  }

  private async renderPayslip(
    tenantId: string,
    run: Prisma.PayRunGetPayload<object>,
    line: LineRow,
  ) {
    const [tenant, emp] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, branding: true },
      }),
      this.prisma.employee.findUnique({
        where: { id: line.employeeId },
        select: { joinDate: true, sensitiveHints: true },
      }),
    ]);
    const branding = (tenant?.branding ?? {}) as {
      address?: string;
      contactPhone?: string;
      contactEmail?: string;
    };
    const hints = (emp?.sensitiveHints ?? {}) as Record<string, string>;
    const input: PayslipInput = {
      school: {
        name: tenant?.name ?? '',
        address: branding.address,
        contact: [branding.contactPhone, branding.contactEmail]
          .filter(Boolean)
          .join(' · '),
      },
      month: run.month,
      runStatus: run.status,
      paidAt: run.paidAt,
      paymentReference: run.paymentReference,
      employee: {
        code: line.employeeCode,
        name: line.employeeName,
        designation: line.designation,
        department: line.department,
        joinDate: emp ? fromDbDate(emp.joinDate) : run.month + '-01',
        panMasked: hints.pan ?? null,
        bankMasked: hints.bankAccount ?? null,
      },
      periodDays: line.periodDays,
      lopDays: Number(line.lopDays.toString()),
      paidDays: Number(line.paidDays.toString()),
      items: line.items.map((i) => ({
        kind: i.kind,
        name: i.name,
        amountPaise: toPaise(i.amount),
        reason: i.reason,
        adjustment: i.source === 'ADJUSTMENT',
      })),
      grossPaise: toPaise(line.grossEarnings),
      deductionsPaise: toPaise(line.totalDeductions),
      netPaise: toPaise(line.netPay),
    };
    const pdf = await buildPayslipPdf(input);
    const safe = line.employeeCode.replace(/[^A-Za-z0-9_-]/g, '_');
    return {
      pdf,
      filename: `payslip-${safe}-${run.month}.pdf`,
      label: monthLabel(run.month),
    };
  }
}
