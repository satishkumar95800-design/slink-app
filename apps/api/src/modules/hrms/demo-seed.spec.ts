/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake and plain seed rows */
import { buildDemoHrms } from './demo-seed';
import { weekday } from './hrms-dates';
import { toPaise } from './payroll.math';

const teachers = ['t1', 't2', 't3', 't4', 't5', 't6', 't7'].map((id, i) => ({
  id,
  name: `Teacher ${i + 1}`,
  phone: `+9198000000${i}`,
}));
const people = (today: string) => ({
  tenantId: 'tenant-demo',
  adminId: 'admin',
  accountantId: 'accountant',
  teachers,
  holidays: [
    `${today.slice(0, 4)}-08-15`,
    `${today.slice(0, 4)}-10-02`,
    `${Number(today.slice(0, 4)) - 1}-12-25`,
    `${today.slice(0, 4)}-01-26`,
  ],
});
const fakeEncrypt = (s: string) => `enc:${s}`;
const ymd = (d: unknown) => (d as Date).toISOString().slice(0, 10);

describe.each(['2026-10-15', '2026-03-03', '2027-01-31', '2026-12-01'])(
  'demo HR data on %s',
  (today) => {
    const data = buildDemoHrms(people(today), today, fakeEncrypt);
    const lines = data.payRunLines as any[];
    const items = data.payRunLineItems as any[];

    it('has about twelve employees including ground staff with no login', () => {
      expect(data.employees).toHaveLength(12);
      expect(data.employees.filter((e: any) => e.userId === null)).toHaveLength(
        4,
      );
      expect(new Set(data.employees.map((e: any) => e.employeeCode)).size).toBe(
        12,
      );
      expect(
        data.employees.filter((e: any) => e.userId).map((e: any) => e.userId),
      ).toEqual(expect.arrayContaining(['admin', 'accountant', 't1']));
      expect(data.structures).toHaveLength(12);
    });

    it('seeds two locked runs and one awaiting approval, one run per month', () => {
      const runs = data.payRuns as any[];
      expect(runs.filter((r) => r.status === 'LOCKED')).toHaveLength(2);
      expect(runs.filter((r) => r.status === 'REVIEW')).toHaveLength(1);
      expect(new Set(runs.map((r) => r.month)).size).toBe(3);
      for (const r of runs.filter((x) => x.status === 'LOCKED')) {
        expect(r.approvedBy).toBe('admin');
        expect(r.preparedBy).toBe('accountant');
        expect(r.selfApproved).toBe(false);
        expect(r.lockedAt).toBeInstanceOf(Date);
      }
      expect(runs.filter((r) => r.paidAt)).toHaveLength(1);
      expect(runs.every((r) => r.month < today.slice(0, 7))).toBe(true);
    });

    it('every line reconciles with its items and never goes negative', () => {
      expect(lines.length).toBeGreaterThanOrEqual(30);
      for (const l of lines) {
        const mine = items.filter((i) => i.lineId === l.id);
        const earn = mine
          .filter((i) => i.kind === 'EARNING')
          .reduce((s, i) => s + toPaise(i.amount), 0);
        const ded = mine
          .filter((i) => i.kind === 'DEDUCTION')
          .reduce((s, i) => s + toPaise(i.amount), 0);
        expect(toPaise(l.grossEarnings)).toBe(earn);
        expect(toPaise(l.totalDeductions)).toBe(ded);
        expect(toPaise(l.netPay)).toBe(earn - ded);
        expect(toPaise(l.netPay)).toBeGreaterThanOrEqual(0);
        expect(Number(l.paidDays) + Number(l.lopDays)).toBe(l.periodDays);
      }
      expect(
        new Set(lines.map((l) => `${l.payRunId}:${l.employeeId}`)).size,
      ).toBe(lines.length);
    });

    it('statutory deductions follow the configured defaults (PF capped, ESI only for low earners)', () => {
      const pfItems = items.filter((i) => i.code === 'PF');
      expect(pfItems.length).toBeGreaterThan(0);
      for (const i of pfItems)
        expect(toPaise(i.amount)).toBeLessThanOrEqual(180_000);
      const esiLines = new Set(
        items.filter((i) => i.code === 'ESI').map((i) => i.lineId),
      );
      for (const id of esiLines) {
        const l = lines.find((x) => x.id === id);
        expect(toPaise(l.grossEarnings)).toBeLessThanOrEqual(2_100_000);
      }
      expect(items.some((i) => i.code === 'PT')).toBe(true);
      expect(items.some((i) => i.source === 'ADJUSTMENT' && i.reason)).toBe(
        true,
      );
      expect(items.some((i) => i.name === 'TDS')).toBe(true);
    });

    it('a mid-month joiner is paid only from the joining date', () => {
      const helper = data.employees.find(
        (e: any) => e.designation === 'Helper',
      ) as any;
      const first = lines
        .filter((l) => l.employeeId === helper.id)
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      expect(Number(first.lopDays)).toBeGreaterThan(0);
      expect(lines.filter((l) => l.employeeId === helper.id)).toHaveLength(2);
    });

    it('attendance: one row per employee and day, nothing in the future, none on Sundays or holidays', () => {
      const rows = data.attendance as any[];
      expect(
        new Set(rows.map((r) => `${r.employeeId}:${ymd(r.date)}`)).size,
      ).toBe(rows.length);
      const hol = new Set(people(today).holidays);
      for (const r of rows) {
        expect(ymd(r.date) <= today).toBe(true);
        expect(weekday(ymd(r.date))).not.toBe(0);
        expect(hol.has(ymd(r.date))).toBe(false);
      }
      const byEmp = new Map(
        data.employees.map((e: any) => [e.id, ymd(e.joinDate)]),
      );
      for (const r of rows)
        expect(ymd(r.date) >= (byEmp.get(r.employeeId) as string)).toBe(true);
    });

    it('leave: approved requests have matching attendance, none overlap, balances are respected', () => {
      const reqs = data.leaveRequests as any[];
      const approved = reqs.filter((r) => r.status === 'APPROVED');
      expect(approved.length).toBeGreaterThanOrEqual(5);
      expect(reqs.some((r) => r.status === 'PENDING')).toBe(true);
      expect(reqs.some((r) => r.status === 'REJECTED' && r.decisionNote)).toBe(
        true,
      );
      expect(reqs.some((r) => r.status === 'CANCELLED')).toBe(true);
      for (const r of approved) {
        const rows = (data.attendance as any[]).filter(
          (a) => a.leaveRequestId === r.id,
        );
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length * (r.halfDay ? 0.5 : 1)).toBe(Number(r.days));
      }
      for (const a of reqs)
        for (const b of reqs) {
          if (
            a.id < b.id &&
            a.employeeId === b.employeeId &&
            a.status !== 'CANCELLED' &&
            a.status !== 'REJECTED' &&
            b.status !== 'CANCELLED' &&
            b.status !== 'REJECTED'
          ) {
            expect(a.toDate < b.fromDate || b.toDate < a.fromDate).toBe(true);
          }
        }
      const used = new Map<string, number>();
      for (const r of approved)
        used.set(
          `${r.employeeId}:${r.leaveTypeId}`,
          (used.get(`${r.employeeId}:${r.leaveTypeId}`) ?? 0) + Number(r.days),
        );
      for (const lt of data.leaveTypes as any[]) {
        if (!lt.isPaid) continue;
        for (const [k, v] of used)
          if (k.endsWith(`:${lt.id}`))
            expect(v).toBeLessThanOrEqual(Number(lt.yearlyAllowance));
      }
    });

    it('unpaid leave reaches payroll as loss of pay', () => {
      const peon = data.employees.find(
        (e: any) => e.designation === 'Peon',
      ) as any;
      const months = (data.payRuns as any[]).filter((r) =>
        lines.some(
          (l) =>
            l.payRunId === r.id &&
            l.employeeId === peon.id &&
            Number(l.lopDays) >= 2,
        ),
      );
      expect(months.length).toBeGreaterThanOrEqual(1);
    });
  },
);

describe('demo HR data: sensitive values and determinism', () => {
  const today = '2026-10-15';
  it('stores sensitive values only when an encryption function is available, never in the clear', () => {
    const none = buildDemoHrms(people(today), today, null);
    expect(
      none.employees.every((e: any) => !e.bankAccountEnc && !e.panEnc),
    ).toBe(true);
    const some = buildDemoHrms(people(today), today, fakeEncrypt);
    for (const e of some.employees as any[]) {
      expect(e.bankAccountEnc).toMatch(/^enc:/);
      expect(JSON.stringify(e.sensitiveHints)).not.toMatch(
        /5010000\d{4}(?!\d)/,
      );
    }
  });

  it('is deterministic apart from generated ids', () => {
    const a = buildDemoHrms(people(today), today, null);
    const b = buildDemoHrms(people(today), today, null);
    const nets = (d: typeof a) =>
      (d.payRunLines as any[])
        .map((l) => `${l.employeeCode}:${l.netPay}`)
        .sort();
    expect(nets(a)).toEqual(nets(b));
    expect(a.summary).toEqual(b.summary);
  });
});
