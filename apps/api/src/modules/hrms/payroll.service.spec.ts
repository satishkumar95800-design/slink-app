/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake and plain seed rows */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { HrCrypto } from './hr-crypto.service';
import { HrSettingsService } from './hr-settings.service';
import { PayrollService } from './payroll.service';
import { StaffAttendanceService } from './staff-attendance.service';
import { MeService } from './me.service';
import { createDb } from './test-db';

const KEY = 'k'.repeat(40);
const T1 = 't1';
const T2 = 't2';
const MONTH = '2024-03';
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const user = (role: Role, id = `${role}-1`, tenantId = T1): ActiveUser => ({
  id,
  role,
  tenantId,
  name: id,
  isVerified: true,
});
const ADMIN = user(Role.admin);
const ADMIN2 = user(Role.admin, 'admin-2');
const ACCOUNTS = user(Role.accounts);

function setup() {
  const crypto = new HrCrypto({ get: () => KEY } as never);
  const emp = (
    id: string,
    tenantId: string,
    name: string,
    over: Record<string, unknown> = {},
  ) => ({
    id,
    tenantId,
    name,
    employeeCode: `C-${id}`,
    designation: 'Teacher',
    department: 'Primary',
    joinDate: day('2023-04-01'),
    status: 'ACTIVE',
    bankAccountEnc: crypto.encrypt('111122223333'),
    bankIfscEnc: crypto.encrypt('HDFC0001234'),
    bankHolderEnc: crypto.encrypt(name),
    sensitiveHints: { pan: 'XXXXXX234F', bankAccount: 'XXXXXXXX3333' },
    ...over,
  });
  const structure = (
    employeeId: string,
    over: Record<string, unknown> = {},
  ) => ({
    id: `s-${employeeId}`,
    tenantId: T1,
    employeeId,
    effectiveFrom: day('2023-04-01'),
    basic: '20000.00',
    components: [
      {
        name: 'HRA',
        kind: 'EARNING',
        calc: 'PERCENT_OF_BASIC',
        percentBp: 4000,
      },
    ],
    pfApplicable: true,
    esiApplicable: false,
    ptApplicable: true,
    ...over,
  });
  const db = createDb({
    tenant: [
      {
        id: T1,
        name: 'Greenfield School',
        timezone: 'Asia/Kolkata',
        branding: { address: 'Bengaluru' },
      },
      { id: T2, name: 'Other School', timezone: 'Asia/Kolkata', branding: {} },
    ],
    employee: [
      emp('e1', T1, 'Tara Teacher', { userId: 'u-tara' }),
      emp('e2', T1, 'Ravi Peon', { userId: null, designation: 'Peon' }),
      emp('e3', T1, '=Evil Name', {
        bankAccountEnc: null,
        bankIfscEnc: null,
        designation: 'Cook',
      }),
      emp('e9', T1, 'No Structure Nisha'),
      emp('ex', T2, 'Other School Person'),
    ],
    salaryStructure: [
      structure('e1'),
      structure('e2', { basic: '12000.00' }),
      structure('e3', { basic: '10000.00', pfApplicable: false }),
      { ...structure('ex'), tenantId: T2 },
    ],
  });
  const settings = new HrSettingsService(db.prisma as never);
  const attendance = new StaffAttendanceService(db.prisma as never, settings);
  const svc = new PayrollService(
    db.prisma as never,
    settings,
    attendance,
    crypto,
  );
  const me = new MeService(db.prisma as never, {} as never, svc);
  return { db, svc, crypto, settings, me };
}

const fullRun = async (svc: PayrollService, actor = ACCOUNTS, month = MONTH) =>
  (await svc.generate(T1, actor, { month })) as any;

describe('PayrollService.generate', () => {
  it('builds one snapshot line per employee with a structure and reports the rest', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    expect(run.status).toBe('DRAFT');
    expect(run.lines).toHaveLength(3);
    expect(run.skipped.map((s: any) => s.name)).toEqual(['No Structure Nisha']);
    const tara = run.lines.find((l: any) => l.employeeCode === 'C-e1');
    expect(tara.gross).toBe('28000.00'); // 20,000 + 40% HRA
    const detail = await svc.getLine(T1, run.id, tara.id);
    const pf = detail.items.find((i: any) => i.code === 'PF')!;
    expect(pf.amount).toBe('1800.00'); // 12% of ceiling 15,000
    expect(detail.items.find((i: any) => i.code === 'PT')!.amount).toBe(
      '200.00',
    );
    expect(detail.net).toBe('26000.00');
    expect(detail.flags).toEqual(['UNMARKED_DAYS']); // nobody marked attendance in this fixture
    expect(
      run.lines.find((l: any) => l.employeeCode === 'C-e3').flags,
    ).toContain('NO_BANK_DETAILS');
  });

  it('uses attendance for loss of pay', async () => {
    const { svc, db } = setup();
    db.create('staffAttendance', {
      tenantId: T1,
      employeeId: 'e2',
      date: day('2024-03-04'),
      status: 'ABSENT',
    });
    db.create('staffAttendance', {
      tenantId: T1,
      employeeId: 'e2',
      date: day('2024-03-05'),
      status: 'HALF_DAY',
    });
    const run = await fullRun(svc);
    const line = run.lines.find((l: any) => l.employeeCode === 'C-e2');
    expect(line.lopDays).toBe(1.5);
    expect(line.paidDays).toBe(29.5);
    // basic 12,000 + 40% = 16,800 gross, prorated by 29.5/31
    expect(line.gross).toBe('15987.09'); // 11419.35 (basic) + 4567.74 (HRA), each rounded half-up
  });

  it('is idempotent per month: a second run is refused, a cancelled one frees the month', async () => {
    const { svc, db } = setup();
    const first = await fullRun(svc);
    await expect(
      svc.generate(T1, ACCOUNTS, { month: MONTH }),
    ).rejects.toMatchObject({
      response: { code: 'PAY_RUN_EXISTS', payRunId: first.id },
    });
    await svc.cancel(T1, ACCOUNTS, first.id, 'wrong month data');
    const again = await fullRun(svc);
    expect(again.id).not.toBe(first.id);
    expect(
      db.table('payRun').filter((r) => r.status !== 'CANCELLED'),
    ).toHaveLength(1);
  });

  it('takes the advisory lock and rejects future months and malformed months', async () => {
    const { svc, db } = setup();
    await fullRun(svc);
    expect(db.prisma.$executeRaw).toHaveBeenCalled();
    await expect(
      svc.generate(T1, ACCOUNTS, { month: '2999-01' }),
    ).rejects.toMatchObject({ response: { code: 'FUTURE_MONTH' } });
    await expect(
      svc.generate(T1, ACCOUNTS, { month: '2024-13' }),
    ).rejects.toMatchObject({ response: { code: 'MONTH_INVALID' } });
  });

  it('never mixes schools', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    expect(run.lines.some((l: any) => l.employeeCode === 'C-ex')).toBe(false);
    await expect(svc.get(T2, run.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.submit(T2, user(Role.accounts, 'a2', T2), run.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('later structure changes never rewrite an existing run', async () => {
    const { svc, db } = setup();
    const run = await fullRun(svc);
    db.table('salaryStructure').find((s) => s.employeeId === 'e1').basic =
      '99999.00';
    const after = await svc.get(T1, run.id);
    expect(after.lines.find((l) => l.employeeCode === 'C-e1')?.gross).toBe(
      '28000.00',
    );
  });
});

describe('PayrollService adjustments', () => {
  it('adds and removes one-off allowances and deductions, keeping totals consistent', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    const tara = run.lines.find((l: any) => l.employeeCode === 'C-e1');
    const withBonus = await svc.addAdjustment(T1, ACCOUNTS, run.id, tara.id, {
      type: 'ALLOWANCE',
      name: 'Bonus',
      amount: 1000,
      reason: 'Diwali',
    });
    expect(withBonus.gross).toBe('29000.00');
    expect(withBonus.net).toBe('27000.00');
    const withRecovery = await svc.addAdjustment(
      T1,
      ACCOUNTS,
      run.id,
      tara.id,
      { type: 'DEDUCTION', name: 'Advance', amount: 500, reason: 'Recovery' },
    );
    expect(withRecovery.net).toBe('26500.00');
    const adj = withRecovery.items.filter(
      (i: any) => i.source === 'ADJUSTMENT',
    );
    expect(adj.map((i: any) => i.reason)).toEqual(['Diwali', 'Recovery']);
    const removed = await svc.removeAdjustment(
      T1,
      ACCOUNTS,
      run.id,
      tara.id,
      adj[0].id,
    );
    expect(removed.net).toBe('25500.00');
  });

  it('refuses an adjustment that would make net pay negative', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    const line = run.lines[0];
    await expect(
      svc.addAdjustment(T1, ACCOUNTS, run.id, line.id, {
        type: 'DEDUCTION',
        name: 'x',
        amount: 9_000_000,
        reason: 'r',
      }),
    ).rejects.toMatchObject({
      response: { code: 'ADJUSTMENT_NEGATIVE' },
    });
  });

  it('regenerate keeps adjustments and refreshes figures', async () => {
    const { svc, db } = setup();
    const run = await fullRun(svc);
    const tara = run.lines.find((l: any) => l.employeeCode === 'C-e1');
    await svc.addAdjustment(T1, ACCOUNTS, run.id, tara.id, {
      type: 'ALLOWANCE',
      name: 'Bonus',
      amount: 1000,
      reason: 'Diwali',
    });
    db.create('staffAttendance', {
      tenantId: T1,
      employeeId: 'e1',
      date: day('2024-03-04'),
      status: 'ABSENT',
    });
    const again: any = await svc.regenerate(T1, ACCOUNTS, run.id);
    const line = again.lines.find((l: any) => l.employeeCode === 'C-e1');
    expect(line.lopDays).toBe(1);
    const detail = await svc.getLine(T1, run.id, line.id);
    expect(
      detail.items.some(
        (i: any) => i.name === 'Bonus' && i.reason === 'Diwali',
      ),
    ).toBe(true);
  });
});

describe('PayrollService state machine and approval gate', () => {
  it('walks DRAFT -> REVIEW -> APPROVED -> LOCKED -> paid, in order only', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    await expect(svc.approve(T1, ADMIN, run.id)).rejects.toMatchObject({
      response: { code: 'BAD_STATE' },
    });
    await expect(svc.lock(T1, ADMIN, run.id)).rejects.toMatchObject({
      response: { code: 'BAD_STATE' },
    });
    expect((await svc.submit(T1, ACCOUNTS, run.id)).status).toBe('REVIEW');
    await expect(svc.submit(T1, ACCOUNTS, run.id)).rejects.toMatchObject({
      response: { code: 'BAD_STATE' },
    });
    await expect(svc.lock(T1, ADMIN, run.id)).rejects.toMatchObject({
      response: { code: 'BAD_STATE' },
    });
    expect((await svc.approve(T1, ADMIN, run.id)).status).toBe('APPROVED');
    expect((await svc.lock(T1, ADMIN, run.id)).status).toBe('LOCKED');
    await expect(
      svc.markPaid(T1, ACCOUNTS, run.id, 'UTR123'),
    ).resolves.toMatchObject({ status: 'LOCKED', paymentReference: 'UTR123' });
    await expect(
      svc.markPaid(T1, ACCOUNTS, run.id, 'UTR124'),
    ).rejects.toMatchObject({ response: { code: 'ALREADY_PAID' } });
  });

  it('mark-paid needs a locked run', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    await expect(svc.markPaid(T1, ACCOUNTS, run.id, 'x')).rejects.toMatchObject(
      { response: { code: 'NOT_LOCKED' } },
    );
  });

  it('accounts can prepare and submit but can never approve or lock, so nobody approves a run they prepared as accounts', async () => {
    const { svc } = setup();
    const run = await fullRun(svc, ACCOUNTS);
    await svc.submit(T1, ACCOUNTS, run.id);
    await expect(svc.approve(T1, ACCOUNTS, run.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await svc.approve(T1, ADMIN, run.id);
    await expect(svc.lock(T1, ACCOUNTS, run.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("an admin approving an accountant's run is not self-approval; approving their own is, and it is audited", async () => {
    const { svc, db } = setup();
    const theirs = await fullRun(svc, ACCOUNTS);
    await svc.submit(T1, ACCOUNTS, theirs.id);
    const a = await svc.approve(T1, ADMIN, theirs.id);
    expect(a.selfApproved).toBe(false);
    await svc.cancel(T1, ADMIN, theirs.id, 'redo');

    const mine = await fullRun(svc, ADMIN);
    await svc.submit(T1, ADMIN, mine.id);
    const b = await svc.approve(T1, ADMIN, mine.id);
    expect(b.selfApproved).toBe(true);
    const log = db
      .table('auditLog')
      .filter((x) => x.action === 'hrms.payrun.approve');
    expect(log.map((x) => x.diff.selfApproved)).toEqual([false, true]);
    // a different admin approving the first admin's run is not self-approval
    const third = await fullRun(svc, ADMIN, '2024-04');
    await svc.submit(T1, ADMIN, third.id);
    expect((await svc.approve(T1, ADMIN2, third.id)).selfApproved).toBe(false);
  });

  it('a locked run is immutable: no adjustments, regenerate, reopen, cancel or re-approval', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    const line = run.lines[0];
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await svc.lock(T1, ADMIN, run.id);
    const locked = { response: { code: 'PAY_RUN_LOCKED' } };
    await expect(
      svc.addAdjustment(T1, ADMIN, run.id, line.id, {
        type: 'ALLOWANCE',
        name: 'x',
        amount: 1,
        reason: 'r',
      }),
    ).rejects.toMatchObject(locked);
    await expect(
      svc.removeAdjustment(T1, ADMIN, run.id, line.id, 'whatever'),
    ).rejects.toMatchObject(locked);
    await expect(svc.regenerate(T1, ADMIN, run.id)).rejects.toMatchObject(
      locked,
    );
    await expect(svc.reopen(T1, ADMIN, run.id)).rejects.toMatchObject(locked);
    await expect(svc.cancel(T1, ADMIN, run.id, 'no')).rejects.toMatchObject(
      locked,
    );
    await expect(svc.submit(T1, ADMIN, run.id)).rejects.toMatchObject(locked);
    await expect(svc.approve(T1, ADMIN, run.id)).rejects.toMatchObject(locked);
  });

  it('adjustments are draft-only', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    await svc.submit(T1, ACCOUNTS, run.id);
    await expect(
      svc.addAdjustment(T1, ACCOUNTS, run.id, run.lines[0].id, {
        type: 'ALLOWANCE',
        name: 'x',
        amount: 1,
        reason: 'r',
      }),
    ).rejects.toMatchObject({
      response: { code: 'NOT_DRAFT' },
    });
    const reopened = await svc.reopen(T1, ACCOUNTS, run.id);
    expect(reopened.status).toBe('DRAFT');
  });

  it('only an admin can reopen an approved run', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await expect(svc.reopen(T1, ACCOUNTS, run.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await svc.reopen(T1, ADMIN, run.id)).approvedAt).toBeNull();
  });

  it('every transition is audited', async () => {
    const { svc, db } = setup();
    const run = await fullRun(svc);
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await svc.lock(T1, ADMIN, run.id);
    await svc.markPaid(T1, ACCOUNTS, run.id, 'UTR1');
    expect(db.table('auditLog').map((a) => a.action)).toEqual([
      'hrms.payrun.generate',
      'hrms.payrun.submit',
      'hrms.payrun.approve',
      'hrms.payrun.lock',
      'hrms.payrun.mark_paid',
    ]);
  });
});

describe('PayrollService exports', () => {
  const lockedRun = async (svc: PayrollService) => {
    const run = await fullRun(svc);
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await svc.lock(T1, ADMIN, run.id);
    return run;
  };

  it('bank csv needs a locked run, includes decrypted bank details, skips rows without them, and is audited', async () => {
    const { svc, db } = setup();
    const run = await fullRun(svc);
    await expect(svc.bankCsv(T1, ADMIN, run.id)).rejects.toMatchObject({
      response: { code: 'NOT_LOCKED' },
    });
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await svc.lock(T1, ADMIN, run.id);
    const out = await svc.bankCsv(T1, ADMIN, run.id);
    const lines = out.csv.trim().split('\n');
    expect(lines[0]).toBe(
      'Employee Code,Name,Account Holder,Account Number,IFSC,Amount,Narration',
    );
    expect(lines).toHaveLength(3); // two employees with bank details
    expect(lines[1]).toContain('111122223333');
    expect(lines[1]).toContain('HDFC0001234');
    expect(out.excluded).toBe(1);
    expect(
      db
        .table('auditLog')
        .some(
          (a) => a.action === 'hrms.payrun.bank_export' && a.diff.rows === 2,
        ),
    ).toBe(true);
    expect(JSON.stringify(db.table('auditLog'))).not.toContain('111122223333');
  });

  it('neutralises spreadsheet formulas in exported names', async () => {
    const { svc, db } = setup();
    db.table('employee').find((e) => e.id === 'e3').bankAccountEnc =
      db.table('employee')[0].bankAccountEnc;
    db.table('employee').find((e) => e.id === 'e3').bankIfscEnc =
      db.table('employee')[0].bankIfscEnc;
    const run = await lockedRun(svc);
    // line snapshots were taken before the bank fix above, so use the register (all rows) for the name check
    const reg = await svc.registerCsv(T1, run.id);
    expect(reg.csv).toContain("'=Evil Name");
    expect(reg.csv).not.toMatch(/(^|\n)C-e3,=Evil/);
  });

  it('register csv has statutory columns that reconcile with the line totals', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    const reg = await svc.registerCsv(T1, run.id);
    const rows = reg.csv.trim().split('\n').slice(1);
    const tara = rows.find((r) => r.startsWith('C-e1'))!.split(',');
    // Gross, PF, ESI, PT, Other, Total, Net
    expect(tara.slice(7, 14)).toEqual([
      '28000.00',
      '1800.00',
      '0.00',
      '200.00',
      '0.00',
      '2000.00',
      '26000.00',
    ]);
  });

  it('payslip pdf renders for a run line (draft marked), tenant scoped', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    const { pdf, filename } = await svc.payslipPdf(T1, run.id, run.lines[0].id);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(filename).toMatch(/^payslip-.*-2024-03\.pdf$/);
    await expect(
      svc.payslipPdf(T2, run.id, run.lines[0].id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a cancelled run has no payslips or register', async () => {
    const { svc } = setup();
    const run = await fullRun(svc);
    await svc.cancel(T1, ACCOUNTS, run.id, 'oops');
    await expect(
      svc.payslipPdf(T1, run.id, run.lines[0].id),
    ).rejects.toBeDefined();
    await expect(svc.registerCsv(T1, run.id)).rejects.toBeDefined();
  });
});

describe('own-data-only access (mobile)', () => {
  const tara = user(Role.teacher, 'u-tara');
  const stranger = user(Role.teacher, 'u-stranger');

  it('lists only my payslips and only from locked runs', async () => {
    const { svc, me } = setup();
    const draft = await fullRun(svc);
    expect(await me.payslips(tara)).toEqual([]);
    await svc.submit(T1, ACCOUNTS, draft.id);
    await svc.approve(T1, ADMIN, draft.id);
    expect(await me.payslips(tara)).toEqual([]);
    await svc.lock(T1, ADMIN, draft.id);
    const mine = await me.payslips(tara);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ month: MONTH, net: '26000.00' });
  });

  it("cannot fetch another employee's payslip even with a valid line id", async () => {
    const { svc, me } = setup();
    const run = await fullRun(svc);
    await svc.submit(T1, ACCOUNTS, run.id);
    await svc.approve(T1, ADMIN, run.id);
    await svc.lock(T1, ADMIN, run.id);
    const ravi = run.lines.find((l: any) => l.employeeCode === 'C-e2');
    await expect(me.payslipPdf(tara, ravi.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const own = run.lines.find((l: any) => l.employeeCode === 'C-e1');
    const { pdf } = await me.payslipPdf(tara, own.id);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('a draft payslip is not reachable by the employee', async () => {
    const { svc, me } = setup();
    const run = await fullRun(svc);
    const own = run.lines.find((l: any) => l.employeeCode === 'C-e1');
    await expect(me.payslipPdf(tara, own.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("a login with no employee record gets NO_EMPLOYEE_RECORD, never someone else's data", async () => {
    const { me } = setup();
    await expect(me.payslips(stranger)).rejects.toMatchObject({
      response: { code: 'NO_EMPLOYEE_RECORD' },
    });
    await expect(me.profile(stranger)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves the employee from the login within its own school only', async () => {
    const { me, db } = setup();
    // same user id string in another school must not resolve
    db.table('employee').find((e) => e.id === 'ex').userId = 'u-tara';
    const otherTenantTeacher = user(Role.teacher, 'u-tara', T2);
    expect((await me.profile(otherTenantTeacher)).employeeCode).toBe('C-ex');
    expect((await me.profile(tara)).employeeCode).toBe('C-e1');
  });
});

describe('salary structures', () => {
  it('are immutable, effective-dated and validated', async () => {
    const { svc } = setup();
    const created = await svc.createStructure(T1, ACCOUNTS, {
      employeeId: 'e9',
      effectiveFrom: '2024-01-01',
      basic: 15000,
      components: [
        { name: 'HRA', kind: 'EARNING', calc: 'PERCENT_OF_BASIC', percent: 40 },
        { name: 'TDS', kind: 'DEDUCTION', calc: 'FIXED', amount: 300 },
      ],
      pfApplicable: true,
      esiApplicable: false,
      ptApplicable: false,
    });
    expect(created.monthlyGross).toBe('21000.00');
    await expect(
      svc.createStructure(T1, ACCOUNTS, {
        employeeId: 'e9',
        effectiveFrom: '2024-01-01',
        basic: 1,
        components: [],
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
      }),
    ).rejects.toMatchObject({ response: { code: 'STRUCTURE_DUPLICATE' } });
    await expect(
      svc.createStructure(T1, ACCOUNTS, {
        employeeId: 'e9',
        effectiveFrom: '2024-02-01',
        basic: 1,
        components: [{ name: 'PF', kind: 'EARNING', calc: 'FIXED', amount: 1 }],
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
      }),
    ).rejects.toMatchObject({ response: { code: 'COMPONENT_INVALID' } });
  });

  it("refuses another school's employee", async () => {
    const { svc } = setup();
    await expect(
      svc.createStructure(T1, ACCOUNTS, {
        employeeId: 'ex',
        effectiveFrom: '2024-01-01',
        basic: 1,
        components: [],
        pfApplicable: false,
        esiApplicable: false,
        ptApplicable: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a mid-month revision applies from the month it falls in', async () => {
    const { svc, db } = setup();
    db.create('salaryStructure', {
      tenantId: T1,
      employeeId: 'e2',
      effectiveFrom: day('2024-03-15'),
      basic: '30000.00',
      components: [],
      pfApplicable: false,
      esiApplicable: false,
      ptApplicable: false,
    });
    const run = await fullRun(svc);
    expect(run.lines.find((l: any) => l.employeeCode === 'C-e2').gross).toBe(
      '30000.00',
    );
  });
});
