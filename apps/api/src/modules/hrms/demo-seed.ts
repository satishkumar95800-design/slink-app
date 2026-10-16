/**
 * HR & payroll data for the flagged demo school only (prisma/seed-demo.ts):
 * twelve employees (login staff and ground staff), three months of staff
 * attendance and leave, two locked pay runs and one run waiting for approval.
 * Pure and deterministic (own random generator) and built with the real payroll
 * maths, so every figure obeys the module's rules and is unit-tested.
 *
 * Statutory rates here are the same editable defaults every school starts with;
 * they are demo data, not advice.
 */
import { randomUUID } from 'crypto';
import { computePeriod, DayRecord } from './attendance.math';
import { eachDate, monthBounds, previousMonth, weekday } from './hrms-dates';
import { DEFAULT_LEAVE_TYPES } from './hrms.strings';
import { leaveSpan } from './leave.math';
import {
  DEFAULT_PT_SLABS,
  StatutorySettings,
  StructureComponent,
  computePayLine,
  fromPaise,
  toPaise,
} from './payroll.math';

export const DEMO_STATUTORY: StatutorySettings = {
  pfEnabled: true,
  pfEmployeeBp: 1200,
  pfEmployerBp: 1200,
  pfCeilingPaise: 1_500_000,
  esiEnabled: true,
  esiEmployeeBp: 75,
  esiEmployerBp: 325,
  esiCeilingPaise: 2_100_000,
  ptEnabled: true,
  ptSlabs: DEFAULT_PT_SLABS,
};

export interface DemoHrPeople {
  tenantId: string;
  adminId: string;
  accountantId: string;
  /** Teacher logins; the first is the documented demo teacher. At least six are used. */
  teachers: { id: string; name: string; phone: string | null }[];
  /** School holidays (YYYY-MM-DD) known to the demo. */
  holidays: string[];
}

type Plain = Record<string, unknown>;

interface Person {
  key: string;
  userId: string | null;
  name: string;
  phone: string | null;
  designation: string;
  department: string;
  type: 'PERMANENT' | 'CONTRACT' | 'PART_TIME' | 'DAILY_WAGE';
  joinedDaysAgo: number;
  basic: number;
  hraPercent: number;
  other: StructureComponent[];
  pf: boolean;
  esi: boolean;
  pt: boolean;
}

const fixed = (name: string, rupees: number): StructureComponent => ({
  name,
  kind: 'EARNING',
  calc: 'FIXED',
  amountPaise: rupees * 100,
});

interface EmployeeSeedRow extends Record<string, unknown> {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
}

export interface DemoHrms {
  setting: Plain;
  employees: Plain[];
  leaveTypes: Plain[];
  leaveRequests: Plain[];
  attendance: Plain[];
  structures: Plain[];
  payRuns: Plain[];
  payRunLines: Plain[];
  payRunLineItems: Plain[];
  summary: {
    employees: number;
    lockedRuns: number;
    reviewRuns: number;
    attendanceRows: number;
  };
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const addDaysYmd = (ymd: string, n: number) =>
  new Date(db(ymd).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const at = (ymd: string, hour: number) =>
  new Date(`${ymd}T${String(hour).padStart(2, '0')}:00:00.000+05:30`);

export function buildDemoHrms(
  people: DemoHrPeople,
  today: string,
  /** Encrypts sensitive values; null skips them (no PAYMENT_SECRETS_KEY in the seeding environment). */
  encrypt: ((plain: string) => string) | null,
): DemoHrms {
  const { tenantId } = people;
  const rand = rng(20261020);
  const t = people.teachers;

  const staff: Person[] = [
    {
      key: 'admin',
      userId: people.adminId,
      name: 'Gayathri Rao',
      phone: null,
      designation: 'Principal',
      department: 'Administration',
      type: 'PERMANENT',
      joinedDaysAgo: 1500,
      basic: 60000,
      hraPercent: 40,
      other: [
        fixed('Conveyance', 3200),
        { name: 'TDS', kind: 'DEDUCTION', calc: 'FIXED', amountPaise: 350_000 },
      ],
      pf: true,
      esi: false,
      pt: true,
    },
    {
      key: 'accounts',
      userId: people.accountantId,
      name: 'Manjunath Bhat',
      phone: null,
      designation: 'Accountant',
      department: 'Accounts',
      type: 'PERMANENT',
      joinedDaysAgo: 1100,
      basic: 32000,
      hraPercent: 40,
      other: [fixed('Conveyance', 1600)],
      pf: true,
      esi: false,
      pt: true,
    },
    ...[
      { designation: 'Senior Teacher', basic: 38000, join: 1400 },
      { designation: 'Teacher', basic: 30000, join: 900 },
      { designation: 'Teacher', basic: 28000, join: 700 },
      { designation: 'Teacher', basic: 26000, join: 500 },
      { designation: 'Teacher', basic: 25000, join: 400 },
      { designation: 'Assistant Teacher', basic: 18000, join: 220 },
    ].map<Person>((spec, i) => ({
      key: `teacher${i}`,
      userId: t[i]?.id ?? null,
      name: t[i]?.name ?? `Teacher ${i + 1}`,
      phone: t[i]?.phone ?? null,
      designation: spec.designation,
      department: 'Teaching',
      type: i === 5 ? 'CONTRACT' : 'PERMANENT',
      joinedDaysAgo: spec.join,
      basic: spec.basic,
      hraPercent: 40,
      other: i < 4 ? [fixed('Special allowance', 2000 + i * 500)] : [],
      pf: true,
      esi: false,
      pt: true,
    })),
    {
      key: 'driver',
      userId: null,
      name: 'Shivaraj Gowda',
      phone: '+919845000011',
      designation: 'Driver',
      department: 'Transport',
      type: 'PERMANENT',
      joinedDaysAgo: 800,
      basic: 14000,
      hraPercent: 20,
      other: [fixed('Night halt allowance', 1500)],
      pf: true,
      esi: true,
      pt: false,
    },
    {
      key: 'cook',
      userId: null,
      name: 'Lakshmi Devi',
      phone: '+919845000012',
      designation: 'Cook',
      department: 'Kitchen',
      type: 'CONTRACT',
      joinedDaysAgo: 600,
      basic: 11000,
      hraPercent: 10,
      other: [],
      pf: false,
      esi: true,
      pt: false,
    },
    {
      key: 'peon',
      userId: null,
      name: 'Ramesh Naik',
      phone: '+919845000013',
      designation: 'Peon',
      department: 'Support',
      type: 'DAILY_WAGE',
      joinedDaysAgo: 300,
      basic: 9500,
      hraPercent: 0,
      other: [],
      pf: false,
      esi: true,
      pt: false,
    },
    // Joins part-way through the second of the three months, to show joining proration.
    {
      key: 'helper',
      userId: null,
      name: 'Savitha M',
      phone: '+919845000014',
      designation: 'Helper',
      department: 'Support',
      type: 'PART_TIME',
      joinedDaysAgo: -1,
      basic: 8000,
      hraPercent: 0,
      other: [],
      pf: false,
      esi: true,
      pt: false,
    },
  ];

  const m1 = previousMonth(today.slice(0, 7));
  const m2 = previousMonth(m1);
  const m3 = previousMonth(m2);
  const windowFrom = monthBounds(m3).from;
  const windowTo = monthBounds(m1).to;
  const helperJoin = addDaysYmd(monthBounds(m2).from, 14);

  // ── employees ──
  const employees = staff.map((p, i) => {
    const id = randomUUID();
    const join =
      p.key === 'helper' ? helperJoin : addDaysYmd(today, -p.joinedDaysAgo);
    const sensitive: Record<string, unknown> = {};
    const hints: Record<string, string> = {};
    if (encrypt) {
      const acct = `5010000${String(1000 + i)}`;
      sensitive.bankAccountEnc = encrypt(acct);
      sensitive.bankIfscEnc = encrypt('HDFC0000123');
      sensitive.bankHolderEnc = encrypt(p.name);
      hints.bankAccount = `XXXXXX${acct.slice(-4)}`;
      hints.bankIfsc = 'HDFCXXXXXXX';
      hints.bankHolder = `${p.name.charAt(0)}${'X'.repeat(Math.max(3, p.name.length - 1))}`;
      if (p.userId) {
        const pan = `DEMOP${String(1000 + i)}${String.fromCharCode(65 + i)}`;
        sensitive.panEnc = encrypt(pan);
        hints.pan = `XXXXXX${pan.slice(-4)}`;
      }
    }
    const row: EmployeeSeedRow = {
      id,
      tenantId,
      userId: p.userId,
      employeeCode: `EMP-${String(i + 1).padStart(4, '0')}`,
      name: p.name,
      phone: p.phone,
      email: null,
      designation: p.designation,
      department: p.department,
      employmentType: p.type,
      joinDate: db(join),
      status: 'ACTIVE',
      sensitiveHints: hints,
      createdBy: people.adminId,
      createdAt: at(addDaysYmd(join, 0), 10),
      ...sensitive,
    };
    return { person: p, join, row };
  });
  const byKey = new Map(employees.map((e) => [e.person.key, e]));

  // ── structures ──
  const structures = employees.map(({ person: p, row, join }) => {
    const components: StructureComponent[] = [];
    if (p.hraPercent > 0)
      components.push({
        name: 'HRA',
        kind: 'EARNING',
        calc: 'PERCENT_OF_BASIC',
        percentBp: p.hraPercent * 100,
      });
    components.push(...p.other);
    return {
      id: randomUUID(),
      tenantId,
      employeeId: row.id,
      effectiveFrom: db(join),
      basic: fromPaise(p.basic * 100),
      components,
      pfApplicable: p.pf,
      esiApplicable: p.esi,
      ptApplicable: p.pt,
      createdBy: people.adminId,
      createdAt: at(join, 10),
    };
  });
  const structureOf = new Map(structures.map((s) => [s.employeeId, s]));

  // ── leave types ──
  const leaveTypes = DEFAULT_LEAVE_TYPES.map((d) => ({
    id: randomUUID(),
    tenantId,
    name: d.name,
    yearlyAllowance: d.yearlyAllowance.toFixed(1),
    carryForwardCap: d.carryForwardCap.toFixed(1),
    isPaid: d.isPaid,
    isActive: true,
  }));
  const lt = (name: string) => leaveTypes.find((x) => x.name === name)!;
  const holidaySet = new Set(people.holidays);

  // ── leave requests (approved ones also become attendance rows) ──
  const nextMonth = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    return mm === 12
      ? `${y + 1}-01`
      : `${y}-${String(mm + 1).padStart(2, '0')}`;
  };
  const day = (m: string, d: number) => `${m}-${String(d).padStart(2, '0')}`;
  const futureMonth = nextMonth(today.slice(0, 7));
  const planned: {
    who: string;
    type: string;
    from: string;
    to: string;
    half?: boolean;
    status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CANCELLED';
    reason: string;
    note?: string;
  }[] = [
    {
      who: 'teacher1',
      type: 'Casual Leave',
      from: day(m3, 10),
      to: day(m3, 12),
      status: 'APPROVED',
      reason: 'Family function',
    },
    {
      who: 'teacher2',
      type: 'Sick Leave',
      from: day(m2, 5),
      to: day(m2, 6),
      status: 'APPROVED',
      reason: 'Fever',
    },
    {
      who: 'teacher0',
      type: 'Casual Leave',
      from: day(m2, 20),
      to: day(m2, 20),
      half: true,
      status: 'APPROVED',
      reason: 'Bank work',
    },
    {
      who: 'peon',
      type: 'Loss of Pay',
      from: day(m2, 18),
      to: day(m2, 19),
      status: 'APPROVED',
      reason: 'Village visit',
    },
    {
      who: 'teacher3',
      type: 'Casual Leave',
      from: day(m1, 8),
      to: day(m1, 9),
      status: 'APPROVED',
      reason: 'Personal',
    },
    {
      who: 'driver',
      type: 'Sick Leave',
      from: day(m1, 14),
      to: day(m1, 14),
      status: 'APPROVED',
      reason: 'Dental appointment',
    },
    {
      who: 'teacher4',
      type: 'Casual Leave',
      from: day(m1, 22),
      to: day(m1, 23),
      status: 'REJECTED',
      reason: 'Trip',
      note: 'Examinations that week',
    },
    {
      who: 'cook',
      type: 'Casual Leave',
      from: day(m1, 3),
      to: day(m1, 3),
      status: 'CANCELLED',
      reason: 'Not needed any more',
    },
    {
      who: 'teacher1',
      type: 'Casual Leave',
      from: day(futureMonth, 6),
      to: day(futureMonth, 7),
      status: 'PENDING',
      reason: 'Wedding',
    },
    {
      who: 'teacher5',
      type: 'Sick Leave',
      from: day(futureMonth, 12),
      to: day(futureMonth, 12),
      half: true,
      status: 'PENDING',
      reason: 'Check-up',
    },
  ];
  const attendance: Plain[] = [];
  const leaveDays = new Map<
    string,
    Map<string, { half: boolean; paid: boolean }>
  >();
  const leaveRequests = planned.map((p) => {
    const emp = byKey.get(p.who)!;
    const span = leaveSpan(p.from, p.to, !!p.half, [0], holidaySet);
    const id = randomUUID();
    const type = lt(p.type);
    if (p.status === 'APPROVED') {
      for (const d of span.dates) {
        attendance.push({
          id: randomUUID(),
          tenantId,
          employeeId: emp.row.id,
          date: db(d),
          status: p.half ? 'HALF_DAY' : 'ON_LEAVE',
          leaveRequestId: id,
          markedBy: people.adminId,
          createdAt: at(d, 9),
        });
        const m =
          leaveDays.get(emp.row.id) ??
          new Map<string, { half: boolean; paid: boolean }>();
        m.set(d, { half: !!p.half, paid: type.isPaid });
        leaveDays.set(emp.row.id, m);
      }
    }
    return {
      id,
      tenantId,
      employeeId: emp.row.id,
      leaveTypeId: type.id,
      fromDate: db(p.from),
      toDate: db(p.to),
      halfDay: !!p.half,
      days: (span.tenths / 10).toFixed(1),
      reason: p.reason,
      status: p.status,
      requestedBy: emp.person.userId ?? people.accountantId,
      decidedBy:
        p.status === 'APPROVED' || p.status === 'REJECTED'
          ? people.adminId
          : null,
      decidedAt:
        p.status === 'APPROVED' || p.status === 'REJECTED'
          ? at(addDaysYmd(p.from, -2), 11)
          : null,
      decisionNote: p.note ?? null,
      createdAt: at(addDaysYmd(p.from, -4), 10),
    };
  });

  // ── daily attendance for the three months (marked by the accountant) ──
  for (const { row, join } of employees) {
    for (const d of eachDate(windowFrom, windowTo)) {
      if (d < join || weekday(d) === 0 || holidaySet.has(d)) continue;
      if (leaveDays.get(row.id)?.has(d)) continue;
      const r = rand();
      const status = r < 0.035 ? 'ABSENT' : r < 0.055 ? 'HALF_DAY' : 'PRESENT';
      attendance.push({
        id: randomUUID(),
        tenantId,
        employeeId: row.id,
        date: db(d),
        status,
        markedBy: people.accountantId,
        createdAt: at(d, 18),
      });
    }
  }

  // ── pay runs: two locked, the latest waiting for approval ──
  const recordsOf = (employeeId: string) => {
    const m = new Map<string, DayRecord>();
    for (const a of attendance) {
      if (a.employeeId !== employeeId) continue;
      const ymd = (a.date as Date).toISOString().slice(0, 10);
      const ld = leaveDays.get(employeeId)?.get(ymd);
      m.set(ymd, {
        status: a.status as DayRecord['status'],
        leavePaid: a.leaveRequestId ? (ld ? ld.paid : null) : null,
      });
    }
    return m;
  };
  const settingsSnapshot = {
    weeklyOffDays: [0],
    workingDaysRule: 'CALENDAR',
    treatUnmarkedAsAbsent: false,
    leaveYearStartMonth: 4,
    pfEnabled: true,
    pfEmployeeRate: 12,
    pfEmployerRate: 12,
    pfWageCeiling: '15000.00',
    esiEnabled: true,
    esiEmployeeRate: 0.75,
    esiEmployerRate: 3.25,
    esiWageCeiling: '21000.00',
    ptEnabled: true,
    ptSlabs: DEFAULT_PT_SLABS.map((s) => ({
      from: fromPaise(s.fromPaise),
      to: s.toPaise === null ? null : fromPaise(s.toPaise),
      monthly: fromPaise(s.monthlyPaise),
      february:
        s.februaryPaise === undefined ? null : fromPaise(s.februaryPaise),
    })),
  };

  const payRuns: Plain[] = [];
  const payRunLines: Plain[] = [];
  const payRunLineItems: Plain[] = [];
  const runPlan: {
    month: string;
    state: 'LOCKED_PAID' | 'LOCKED' | 'REVIEW';
  }[] = [
    { month: m3, state: 'LOCKED_PAID' },
    { month: m2, state: 'LOCKED' },
    { month: m1, state: 'REVIEW' },
  ];
  for (const plan of runPlan) {
    const runId = randomUUID();
    const { from, to } = monthBounds(plan.month);
    const closeDay = addDaysYmd(to, 2);
    const locked = plan.state !== 'REVIEW';
    payRuns.push({
      id: runId,
      tenantId,
      month: plan.month,
      status: locked ? 'LOCKED' : 'REVIEW',
      settingsSnapshot,
      preparedBy: people.accountantId,
      submittedAt: at(closeDay, 11),
      approvedBy: locked ? people.adminId : null,
      approvedAt: locked ? at(addDaysYmd(closeDay, 1), 12) : null,
      selfApproved: false,
      lockedBy: locked ? people.adminId : null,
      lockedAt: locked ? at(addDaysYmd(closeDay, 1), 13) : null,
      paidAt:
        plan.state === 'LOCKED_PAID' ? at(addDaysYmd(closeDay, 2), 15) : null,
      paidBy: plan.state === 'LOCKED_PAID' ? people.accountantId : null,
      paymentReference: plan.state === 'LOCKED_PAID' ? 'NEFT-DEMO-0001' : null,
      createdAt: at(closeDay, 10),
    });
    for (const { person, row, join } of employees) {
      if (join > to) continue;
      const st = structureOf.get(row.id)!;
      const period = computePeriod({
        month: plan.month,
        rule: 'CALENDAR',
        weeklyOff: [0],
        holidays: new Set(people.holidays.filter((h) => h >= from && h <= to)),
        records: recordsOf(row.id),
        treatUnmarkedAsAbsent: false,
        joinDate: join,
        exitDate: null,
      });
      const calc = computePayLine({
        structure: {
          basicPaise: toPaise(st.basic),
          components: st.components,
          pfApplicable: st.pfApplicable,
          esiApplicable: st.esiApplicable,
          ptApplicable: st.ptApplicable,
        },
        statutory: DEMO_STATUTORY,
        month: plan.month,
        periodDays: period.periodDays,
        lopTenths: period.lopTenths,
        // One festival bonus on the oldest run, to show an adjustment with its reason.
        adjustments:
          plan.month === m3 && person.key === 'teacher0'
            ? [
                {
                  kind: 'EARNING',
                  name: 'Festival bonus',
                  amountPaise: 200_000,
                  reason: 'Annual festival bonus',
                },
              ]
            : [],
      });
      const lineId = randomUUID();
      const flags = [...calc.flags];
      if (!encrypt) flags.push('NO_BANK_DETAILS');
      payRunLines.push({
        id: lineId,
        tenantId,
        payRunId: runId,
        employeeId: row.id,
        employeeCode: row.employeeCode,
        employeeName: row.name,
        designation: row.designation,
        department: row.department,
        structureId: st.id,
        periodDays: period.periodDays,
        lopDays: (period.lopTenths / 10).toFixed(1),
        paidDays: (calc.paidTenths / 10).toFixed(1),
        unmarkedDays: period.unmarkedDays,
        grossEarnings: fromPaise(calc.grossPaise),
        totalDeductions: fromPaise(calc.deductionsPaise),
        netPay: fromPaise(calc.netPaise),
        employerPf: fromPaise(calc.employerPfPaise),
        employerEsi: fromPaise(calc.employerEsiPaise),
        flags,
        bankAccountEnc: row.bankAccountEnc ?? null,
        bankIfscEnc: row.bankIfscEnc ?? null,
        bankHolderEnc: row.bankHolderEnc ?? null,
        createdAt: at(closeDay, 10),
      });
      for (const item of calc.items) {
        payRunLineItems.push({
          id: randomUUID(),
          tenantId,
          lineId,
          kind: item.kind,
          source: item.source,
          code: item.code,
          name: item.name,
          amount: fromPaise(item.amountPaise),
          reason: item.reason ?? null,
          createdBy: item.source === 'ADJUSTMENT' ? people.accountantId : null,
          createdAt: at(closeDay, 10),
        });
      }
    }
  }

  return {
    setting: {
      tenantId,
      weeklyOffDays: [0],
      workingDaysRule: 'CALENDAR',
      ptSlabs: DEFAULT_PT_SLABS,
      slabsSeeded: true,
    },
    employees: employees.map((e) => e.row),
    leaveTypes,
    leaveRequests,
    attendance,
    structures,
    payRuns,
    payRunLines,
    payRunLineItems,
    summary: {
      employees: employees.length,
      lockedRuns: payRuns.filter((r) => r.status === 'LOCKED').length,
      reviewRuns: payRuns.filter((r) => r.status === 'REVIEW').length,
      attendanceRows: attendance.length,
    },
  };
}
