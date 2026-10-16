/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- in-memory Prisma fake and plain seed rows */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { HrSettingsService } from './hr-settings.service';
import { LeaveService } from './leave.service';
import { createDb } from './test-db';

const T1 = 't1';
const T2 = 't2';
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const user = (role: Role, id = `${role}-1`, tenantId = T1): ActiveUser => ({
  id,
  role,
  tenantId,
  name: id,
  isVerified: true,
});
const ADMIN = user(Role.admin);
const ACCOUNTS = user(Role.accounts);

function setup() {
  const db = createDb({
    tenant: [
      { id: T1, timezone: 'Asia/Kolkata', defaultLanguage: 'en' },
      { id: T2, timezone: 'Asia/Kolkata', defaultLanguage: 'en' },
    ],
    user: [{ id: 'u-tara', tenantId: T1, preferredLanguage: 'kn' }],
    employee: [
      {
        id: 'e-tara',
        tenantId: T1,
        name: 'Tara',
        employeeCode: 'EMP-1',
        userId: 'u-tara',
        status: 'ACTIVE',
        joinDate: day('2024-04-01'),
      },
      {
        id: 'e-ravi',
        tenantId: T1,
        name: 'Ravi',
        employeeCode: 'EMP-2',
        userId: null,
        status: 'ACTIVE',
        joinDate: day('2024-04-01'),
      },
      {
        id: 'e-admin',
        tenantId: T1,
        name: 'Ada Admin',
        employeeCode: 'EMP-3',
        userId: 'admin-1',
        status: 'ACTIVE',
        joinDate: day('2024-04-01'),
      },
      {
        id: 'e-acc',
        tenantId: T1,
        name: 'Acc',
        employeeCode: 'EMP-4',
        userId: 'accounts-1',
        status: 'ACTIVE',
        joinDate: day('2024-04-01'),
      },
      {
        id: 'e-x',
        tenantId: T2,
        name: 'Other',
        employeeCode: 'EMP-1',
        userId: null,
        status: 'ACTIVE',
        joinDate: day('2024-04-01'),
      },
    ],
    leaveType: [
      {
        id: 'lt-cl',
        tenantId: T1,
        name: 'Casual Leave',
        yearlyAllowance: 12,
        carryForwardCap: 0,
        isPaid: true,
        isActive: true,
      },
      {
        id: 'lt-lop',
        tenantId: T1,
        name: 'Loss of Pay',
        yearlyAllowance: 0,
        carryForwardCap: 0,
        isPaid: false,
        isActive: true,
      },
    ],
  });
  const settings = new HrSettingsService(db.prisma as never);
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };
  const svc = new LeaveService(
    db.prisma as never,
    settings,
    notifications as never,
  );
  return { db, svc, notifications };
}

// 2026-06-01 is a Monday.
const apply = (
  svc: LeaveService,
  over: Record<string, unknown> = {},
  emp = 'e-tara',
) =>
  svc.apply(T1, 'u-tara', emp, {
    leaveTypeId: 'lt-cl',
    fromDate: '2026-06-01',
    toDate: '2026-06-03',
    reason: 'family',
    ...over,
  });

describe('LeaveService.apply', () => {
  it('counts working days only (weekly off is free) and starts PENDING', async () => {
    const { svc } = setup();
    // Fri 2026-06-05 .. Mon 2026-06-08: Sat & Sun... weekly off default is Sunday only -> Fri, Sat, Mon = 3
    const r = await apply(svc, {
      fromDate: '2026-06-05',
      toDate: '2026-06-08',
    });
    expect(r.status).toBe('PENDING');
    expect(r.days).toBe(3);
  });

  it('half day must be a single working day', async () => {
    const { svc } = setup();
    await expect(apply(svc, { halfDay: true })).rejects.toMatchObject({
      response: { code: 'HALF_DAY_RANGE' },
    });
    const r = await apply(svc, { halfDay: true, toDate: '2026-06-01' });
    expect(r.days).toBe(0.5);
    await expect(
      apply(
        svc,
        { halfDay: true, fromDate: '2026-06-07', toDate: '2026-06-07' },
        'e-ravi',
      ),
    ).rejects.toMatchObject({
      response: { code: 'NO_WORKING_DAYS' },
    });
  });

  it('rejects reversed dates, overlaps and inactive leave types', async () => {
    const { svc, db } = setup();
    await expect(
      apply(svc, { fromDate: '2026-06-03', toDate: '2026-06-01' }),
    ).rejects.toMatchObject({ response: { code: 'RANGE_REVERSED' } });
    await apply(svc);
    await expect(
      apply(svc, { fromDate: '2026-06-03', toDate: '2026-06-04' }),
    ).rejects.toMatchObject({ response: { code: 'LEAVE_OVERLAP' } });
    db.table('leaveType')[0].isActive = false;
    await expect(
      apply(svc, { fromDate: '2026-07-01', toDate: '2026-07-01' }),
    ).rejects.toMatchObject({ response: { code: 'LEAVE_TYPE_NOT_FOUND' } });
  });

  it('stops a paid request that exceeds the balance; unpaid leave is unlimited', async () => {
    const { svc } = setup();
    // 12 allowance, April-start leave year; 14 working days (Mon-Sat, 2 weeks) from 2026-06-01
    await expect(
      apply(svc, { fromDate: '2026-06-01', toDate: '2026-06-20' }),
    ).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_BALANCE' },
    });
    const lop = await apply(svc, {
      leaveTypeId: 'lt-lop',
      fromDate: '2026-06-01',
      toDate: '2026-06-30',
    });
    expect(lop.days).toBeGreaterThan(12);
  });

  it('pending requests hold the balance back', async () => {
    const { svc } = setup();
    await apply(svc, { fromDate: '2026-06-01', toDate: '2026-06-10' }); // 9 working days (Mon-Sat, 2 Sundays off)
    await expect(
      apply(svc, { fromDate: '2026-07-01', toDate: '2026-07-06' }),
    ).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_BALANCE' },
    });
    expect((await svc.balances(T1, 'e-tara', '2026-06-15'))[0]).toMatchObject({
      allowance: 12,
      pending: 9,
      available: 3,
    });
  });

  it("refuses an exited employee and another school's employee", async () => {
    const { svc, db } = setup();
    await expect(
      svc.apply(T1, 'u', 'e-x', {
        leaveTypeId: 'lt-cl',
        fromDate: '2026-06-01',
        toDate: '2026-06-01',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    db.table('employee')[0].status = 'EXITED';
    await expect(apply(svc)).rejects.toMatchObject({
      response: { code: 'EMPLOYEE_INACTIVE' },
    });
  });
});

describe('LeaveService decisions', () => {
  it('approval reflects as ON_LEAVE in staff attendance and notifies the applicant in their language', async () => {
    const { svc, db, notifications } = setup();
    const r = await apply(svc, {
      fromDate: '2026-06-05',
      toDate: '2026-06-08',
    });
    const approved = await svc.approve(T1, ADMIN, r.id, 'ok');
    expect(approved.status).toBe('APPROVED');
    const rows = db.table('staffAttendance');
    expect(rows.map((x) => x.status)).toEqual([
      'ON_LEAVE',
      'ON_LEAVE',
      'ON_LEAVE',
    ]);
    expect(rows.every((x) => x.leaveRequestId === r.id)).toBe(true);
    expect(rows.map((x) => x.date.toISOString().slice(0, 10))).toEqual([
      '2026-06-05',
      '2026-06-06',
      '2026-06-08',
    ]);
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-tara',
        tenantId: T1,
        title: 'ರಜೆ ಮಂಜೂರಾಗಿದೆ',
      }),
    );
    expect(
      db.table('auditLog').some((a) => a.action === 'hrms.leave.approve'),
    ).toBe(true);
  });

  it('a half-day leave becomes a HALF_DAY row', async () => {
    const { svc, db } = setup();
    const r = await apply(svc, { halfDay: true, toDate: '2026-06-01' });
    await svc.approve(T1, ADMIN, r.id);
    expect(db.table('staffAttendance')[0].status).toBe('HALF_DAY');
  });

  it('rejection needs a note, writes no attendance and still notifies', async () => {
    const { svc, db, notifications } = setup();
    const r = await apply(svc);
    await expect(svc.reject(T1, ADMIN, r.id, '  ')).rejects.toMatchObject({
      response: { code: 'NOTE_REQUIRED' },
    });
    const out = await svc.reject(T1, ADMIN, r.id, 'Exam week');
    expect(out.status).toBe('REJECTED');
    expect(out.decisionNote).toBe('Exam week');
    expect(db.table('staffAttendance')).toHaveLength(0);
    expect(notifications.send).toHaveBeenCalledTimes(1);
  });

  it('a decided request cannot be decided again', async () => {
    const { svc } = setup();
    const r = await apply(svc);
    await svc.approve(T1, ADMIN, r.id);
    await expect(svc.approve(T1, ADMIN, r.id)).rejects.toMatchObject({
      response: { code: 'NOT_PENDING' },
    });
    await expect(svc.reject(T1, ADMIN, r.id, 'x')).rejects.toMatchObject({
      response: { code: 'NOT_PENDING' },
    });
  });

  it('a push failure never fails the decision', async () => {
    const { svc, notifications } = setup();
    notifications.send.mockRejectedValue(new Error('fcm down'));
    const r = await apply(svc);
    await expect(svc.approve(T1, ADMIN, r.id)).resolves.toMatchObject({
      status: 'APPROVED',
    });
  });

  it('an admin may decide their own leave (flagged), accounts may not', async () => {
    const { svc, db } = setup();
    const own = await svc.apply(T1, 'admin-1', 'e-admin', {
      leaveTypeId: 'lt-cl',
      fromDate: '2026-06-01',
      toDate: '2026-06-01',
      reason: 'x',
    });
    await svc.approve(T1, ADMIN, own.id);
    expect(
      db.table('auditLog').find((a) => a.action === 'hrms.leave.approve').diff
        .selfApproved,
    ).toBe(true);
    const own2 = await svc.apply(T1, 'accounts-1', 'e-acc', {
      leaveTypeId: 'lt-cl',
      fromDate: '2026-06-01',
      toDate: '2026-06-01',
      reason: 'x',
    });
    await expect(svc.approve(T1, ACCOUNTS, own2.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('is tenant scoped', async () => {
    const { svc } = setup();
    const r = await apply(svc);
    await expect(
      svc.approve(T2, user(Role.admin, 'a2', T2), r.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((await svc.listRequests(T2, {})).total).toBe(0);
  });

  it('approval re-checks the balance', async () => {
    const { svc, db } = setup();
    const r = await apply(svc, {
      fromDate: '2026-06-01',
      toDate: '2026-06-10',
    });
    db.table('leaveType')[0].yearlyAllowance = 2;
    await expect(svc.approve(T1, ADMIN, r.id)).rejects.toMatchObject({
      response: { code: 'INSUFFICIENT_BALANCE' },
    });
  });
});

describe('LeaveService.cancel', () => {
  it('owner cancels a pending request; the balance is released', async () => {
    const { svc } = setup();
    const r = await apply(svc);
    await svc.cancel(T1, user(Role.teacher, 'u-tara'), r.id, 'e-tara');
    expect((await svc.balances(T1, 'e-tara', '2026-06-15'))[0]).toMatchObject({
      pending: 0,
      available: 12,
    });
  });

  it('cancelling an approved leave removes the attendance rows it wrote', async () => {
    const { svc, db } = setup();
    const r = await apply(svc, {
      fromDate: '2099-06-01',
      toDate: '2099-06-02',
    });
    await svc.approve(T1, ADMIN, r.id);
    expect(db.table('staffAttendance')).toHaveLength(2);
    await svc.cancel(T1, user(Role.teacher, 'u-tara'), r.id, 'e-tara');
    expect(db.table('staffAttendance')).toHaveLength(0);
  });

  it("a teacher cannot cancel someone else's request (404, not 403)", async () => {
    const { svc } = setup();
    const r = await apply(svc);
    await expect(
      svc.cancel(T1, user(Role.teacher, 'u-ravi'), r.id, 'e-ravi'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a teacher cannot cancel leave that has already started; an admin can', async () => {
    const { svc } = setup();
    const r = await apply(svc, {
      fromDate: '2024-06-03',
      toDate: '2024-06-04',
    });
    await svc.approve(T1, ADMIN, r.id);
    await expect(
      svc.cancel(T1, user(Role.teacher, 'u-tara'), r.id, 'e-tara'),
    ).rejects.toMatchObject({ response: { code: 'LEAVE_STARTED' } });
    await expect(svc.cancel(T1, ADMIN, r.id, null)).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });
});

describe('LeaveService leave types and balances', () => {
  it('seeds a usual set once, rejects duplicate names, and deactivates instead of deleting', async () => {
    const db = createDb({
      tenant: [{ id: T1, timezone: 'Asia/Kolkata', defaultLanguage: 'en' }],
    });
    const svc = new LeaveService(
      db.prisma as never,
      new HrSettingsService(db.prisma as never),
      {} as never,
    );
    const first = await svc.listTypes(T1);
    expect(first.length).toBeGreaterThanOrEqual(3);
    await svc.listTypes(T1);
    expect(db.table('leaveType')).toHaveLength(first.length);
    await expect(
      svc.createType(T1, ADMIN, {
        name: 'casual leave',
        yearlyAllowance: 1,
        isPaid: true,
      }),
    ).rejects.toMatchObject({ response: { code: 'LEAVE_TYPE_EXISTS' } });
    const t = first[0];
    await svc.updateType(T1, ADMIN, t.id, { isActive: false });
    expect((await svc.listTypes(T1)).map((x) => x.id)).not.toContain(t.id);
    expect((await svc.listTypes(T1, true)).map((x) => x.id)).toContain(t.id);
  });

  it('carry-forward comes from unused days of the previous leave year, capped', async () => {
    const { svc, db } = setup();
    db.table('leaveType')[0].carryForwardCap = 5;
    // last leave year (2025-04..2026-03): approved 4 days
    db.create('leaveRequest', {
      tenantId: T1,
      employeeId: 'e-tara',
      leaveTypeId: 'lt-cl',
      fromDate: day('2025-08-04'),
      toDate: day('2025-08-07'),
      days: 4,
      halfDay: false,
      reason: 'x',
      status: 'APPROVED',
      requestedBy: 'u',
    });
    const b = (await svc.balances(T1, 'e-tara', '2026-06-15'))[0];
    expect(b.carriedIn).toBe(5); // 12 - 4 = 8 unused, capped at 5
    expect(b.available).toBe(17);
    expect(b.yearStart).toBe('2026-04-01');
  });

  it('balances for everyone are computed per employee', async () => {
    const { svc } = setup();
    await apply(svc, { fromDate: '2026-06-01', toDate: '2026-06-02' });
    const all = await svc.balancesForAll(T1, '2026-06-15');
    const tara = all.find((x) => x.employeeId === 'e-tara')!;
    expect(tara.balances[0].pending).toBe(2);
    expect(
      all.find((x) => x.employeeId === 'e-ravi')!.balances[0].pending,
    ).toBe(0);
    expect(all.find((x) => x.employeeId === 'e-x')).toBeUndefined();
  });

  it("one employee comes back in the same shape, and another school's employee is invisible", async () => {
    const { svc } = setup();
    const one = await svc.balancesForAll(T1, '2026-06-15', 'e-tara');
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({
      employeeId: 'e-tara',
      employeeCode: 'EMP-1',
      name: 'Tara',
    });
    expect(one[0].balances.length).toBeGreaterThan(0);
    expect(await svc.balancesForAll(T1, '2026-06-15', 'e-x')).toEqual([]);
  });
});
