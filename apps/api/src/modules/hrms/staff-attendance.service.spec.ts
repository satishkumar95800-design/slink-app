/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- in-memory Prisma fake and plain seed rows */
import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { HrSettingsService, validateSlabs } from './hr-settings.service';
import { StaffAttendanceService } from './staff-attendance.service';
import { createDb } from './test-db';

const T1 = 't1';
const T2 = 't2';
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const ADMIN: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: T1,
  name: 'a',
  isVerified: true,
};

function setup() {
  const db = createDb({
    tenant: [{ id: T1, timezone: 'Asia/Kolkata' }],
    employee: [
      {
        id: 'e1',
        tenantId: T1,
        name: 'Tara',
        employeeCode: 'E1',
        designation: 'Teacher',
        department: null,
        status: 'ACTIVE',
        joinDate: day('2024-01-01'),
      },
      {
        id: 'e2',
        tenantId: T1,
        name: 'Ravi',
        employeeCode: 'E2',
        designation: 'Peon',
        department: null,
        status: 'ACTIVE',
        joinDate: day('2024-01-01'),
      },
      {
        id: 'e3',
        tenantId: T1,
        name: 'Late Joiner',
        employeeCode: 'E3',
        designation: 'X',
        department: null,
        status: 'ACTIVE',
        joinDate: day('2024-03-20'),
      },
      {
        id: 'eo',
        tenantId: T2,
        name: 'Other',
        employeeCode: 'E1',
        designation: 'X',
        department: null,
        status: 'ACTIVE',
        joinDate: day('2024-01-01'),
      },
    ],
    schoolHoliday: [
      {
        id: 'h1',
        tenantId: T1,
        date: day('2024-03-08'),
        name: 'Maha Shivaratri',
      },
    ],
  });
  const settings = new HrSettingsService(db.prisma as never);
  return {
    db,
    svc: new StaffAttendanceService(db.prisma as never, settings),
    settings,
  };
}

describe('StaffAttendanceService', () => {
  it('daily sheet lists employed staff and shows holiday / weekly off', async () => {
    const { svc } = setup();
    const sheet = await svc.daily(T1, '2024-03-08');
    expect(sheet.dayKind).toBe('HOLIDAY');
    expect(sheet.holidayName).toBe('Maha Shivaratri');
    expect(sheet.rows.map((r) => r.employeeCode)).toEqual(['E2', 'E1']); // sorted by name; E3 has not joined yet, other school hidden
    expect((await svc.daily(T1, '2024-03-10')).dayKind).toBe('WEEKLY_OFF'); // Sunday
  });

  it('bulk upsert is idempotent per employee and day', async () => {
    const { svc, db } = setup();
    const dto = {
      date: '2024-03-04',
      entries: [
        { employeeId: 'e1', status: 'PRESENT' },
        { employeeId: 'e2', status: 'ABSENT', note: 'sick' },
      ],
    } as never;
    await svc.saveDaily(T1, ADMIN, dto);
    await svc.saveDaily(T1, ADMIN, {
      date: '2024-03-04',
      entries: [{ employeeId: 'e2', status: 'HALF_DAY' }],
    } as never);
    const rows = db.table('staffAttendance');
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.employeeId === 'e2').status).toBe('HALF_DAY');
    expect(db.table('auditLog')).toHaveLength(2);
  });

  it('validates the date, future days, duplicates and foreign or unjoined employees', async () => {
    const { svc } = setup();
    await expect(
      svc.saveDaily(T1, ADMIN, {
        date: '2024-02-30',
        entries: [{ employeeId: 'e1', status: 'PRESENT' }],
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.saveDaily(T1, ADMIN, {
        date: '2999-01-01',
        entries: [{ employeeId: 'e1', status: 'PRESENT' }],
      } as never),
    ).rejects.toMatchObject({ response: { code: 'FUTURE_DATE' } });
    await expect(
      svc.saveDaily(T1, ADMIN, {
        date: '2024-03-04',
        entries: [
          { employeeId: 'e1', status: 'PRESENT' },
          { employeeId: 'e1', status: 'ABSENT' },
        ],
      } as never),
    ).rejects.toMatchObject({ response: { code: 'DUPLICATE_EMPLOYEE' } });
    await expect(
      svc.saveDaily(T1, ADMIN, {
        date: '2024-03-04',
        entries: [{ employeeId: 'eo', status: 'PRESENT' }],
      } as never),
    ).rejects.toMatchObject({ response: { code: 'EMPLOYEE_NOT_FOUND' } });
    await expect(
      svc.saveDaily(T1, ADMIN, {
        date: '2024-03-04',
        entries: [{ employeeId: 'e3', status: 'PRESENT' }],
      } as never),
    ).rejects.toMatchObject({ response: { code: 'EMPLOYEE_NOT_FOUND' } });
  });

  it('leaves leave-linked rows untouched and reports them as skipped', async () => {
    const { svc, db } = setup();
    db.create('staffAttendance', {
      tenantId: T1,
      employeeId: 'e1',
      date: day('2024-03-04'),
      status: 'ON_LEAVE',
      leaveRequestId: 'lr1',
    });
    const out = await svc.saveDaily(T1, ADMIN, {
      date: '2024-03-04',
      entries: [
        { employeeId: 'e1', status: 'PRESENT' },
        { employeeId: 'e2', status: 'PRESENT' },
      ],
    } as never);
    expect(out).toMatchObject({ saved: 1, skipped: ['e1'] });
    expect(
      db.table('staffAttendance').find((r) => r.employeeId === 'e1').status,
    ).toBe('ON_LEAVE');
  });

  it('monthly summary counts statuses, weekly offs, holidays, unmarked and LOP days', async () => {
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
    db.create('staffAttendance', {
      tenantId: T1,
      employeeId: 'e2',
      date: day('2024-03-06'),
      status: 'PRESENT',
    });
    const m = await svc.monthly(T1, '2024-03');
    expect(m.holidays).toEqual([
      { date: '2024-03-08', name: 'Maha Shivaratri' },
    ]);
    expect(m.totals.weeklyOffs).toBe(5); // Sundays 3,10,17,24,31
    const ravi = m.rows.find((r) => r.employeeCode === 'E2')!;
    expect(ravi).toMatchObject({
      present: 1,
      absent: 1,
      halfDay: 1,
      lopDays: 1.5,
    });
    // 31 days - 5 Sundays - 1 holiday = 25 working days, 3 marked
    expect(ravi.unmarked).toBe(22);
    const late = m.rows.find((r) => r.employeeCode === 'E3')!;
    expect(late.lopDays).toBe(19); // 1..19 March before joining
    expect(
      m.rows.find((r) => r.employeeCode === 'E1' && r.employeeId === 'eo'),
    ).toBeUndefined();
  });

  it('a malformed month is refused', async () => {
    const { svc } = setup();
    await expect(svc.monthly(T1, '2024-3')).rejects.toMatchObject({
      response: { code: 'MONTH_INVALID' },
    });
  });
});

describe('HrSettingsService', () => {
  it('seeds editable PT slab defaults once and exposes money as strings', async () => {
    const { settings, db } = setup();
    const v = await settings.getView(T1);
    expect(v.ptSlabs.length).toBeGreaterThan(0);
    expect(v.pfWageCeiling).toBe('15000.00');
    expect(v.pfEmployeeRate).toBe(12);
    expect(v.esiEmployeeRate).toBe(0.75);
    expect(v.workingDaysRule).toBe('CALENDAR');
    expect(v.weeklyOffDays).toEqual([0]);
    expect(db.table('hrSetting')).toHaveLength(1);
  });

  it('updates, validates slabs and audits before/after', async () => {
    const { settings, db } = setup();
    const out = await settings.update(
      T1,
      {
        workingDaysRule: 'FIXED_30',
        pfEmployeeRate: 10,
        pfWageCeiling: 20000,
        ptSlabs: [
          { from: 0, to: 14999.99, monthly: 0 },
          { from: 15000, to: null, monthly: 150, february: 250 },
        ],
      } as never,
      ADMIN,
    );
    expect(out.workingDaysRule).toBe('FIXED_30');
    expect(out.pfEmployeeRate).toBe(10);
    expect(out.ptSlabs[1]).toMatchObject({
      from: '15000.00',
      monthly: '150.00',
      february: '250.00',
    });
    const log = db
      .table('auditLog')
      .find((a) => a.action === 'hrms.settings.update');
    expect(log.diff.before.pfEmployeeRate).toBe(12);
    expect(log.diff.after.pfEmployeeRate).toBe(10);
    await expect(
      settings.update(
        T1,
        { ptSlabs: [{ from: 100, to: null, monthly: 1 }] },
        ADMIN,
      ),
    ).rejects.toMatchObject({ response: { code: 'SLABS_INVALID' } });
  });

  it('validateSlabs: contiguous from 0, ordered, only the last open-ended', () => {
    const s = (a: number, b: number | null) => ({
      fromPaise: a,
      toPaise: b,
      monthlyPaise: 0,
    });
    expect(validateSlabs([])).toBe(true);
    expect(validateSlabs([s(0, 99), s(100, null)])).toBe(true);
    expect(validateSlabs([s(0, 99), s(101, null)])).toBe(false);
    expect(validateSlabs([s(0, null), s(100, 200)])).toBe(false);
    expect(validateSlabs([s(0, 50), s(40, null)])).toBe(false);
  });
});
