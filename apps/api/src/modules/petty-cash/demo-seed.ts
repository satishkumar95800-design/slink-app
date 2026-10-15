/**
 * Petty cash data for the flagged demo school only (prisma/seed-demo.ts): about
 * five months of plausible history so the forecast and savings advice can be
 * seen, plus a pending, a rejected and a voided entry. Pure and deterministic
 * (own random generator), so it never disturbs the rest of the demo seed.
 *
 * Every row obeys the module's rules: the float never goes negative, nothing is
 * over-settled, and amounts above the approval threshold carry an admin approval.
 */
import { randomUUID } from 'crypto';
import { DEFAULT_CATEGORIES } from './petty-cash.strings';

export const DEMO_SETTINGS = {
  approvalThreshold: '2000.00',
  monthlyBudget: '18000.00',
  receiptRequiredAbove: '500.00',
  overdueDays: 7,
};

const BUDGETS: Record<(typeof DEFAULT_CATEGORIES)[number], string | null> = {
  Stationery: '4000.00',
  'Repairs & Maintenance': '8000.00',
  Refreshments: '5000.00',
  Transport: '3000.00',
  Events: '6000.00',
  Miscellaneous: '2000.00',
};

export interface DemoPeople {
  tenantId: string;
  adminId: string;
  accountantId: string;
  /** Teacher user ids; the first is the demo teacher, the third settles late. */
  teacherIds: string[];
}

export interface DemoSeedRow {
  id: string;
  tenantId: string;
  type: 'TOP_UP' | 'DISBURSEMENT' | 'EXPENSE' | 'RETURN';
  amount: string;
  date: Date;
  categoryId: string | null;
  description: string;
  receiptKey: string | null;
  recipientUserId: string | null;
  payeeId: string | null;
  settlesEntryId: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED';
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  voidReason: string | null;
  voidedBy: string | null;
  voidedAt: Date | null;
  createdAt: Date;
}

export interface DemoPettyCash {
  settings: { tenantId: string; categoriesSeeded: true } & typeof DEMO_SETTINGS;
  categories: {
    id: string;
    tenantId: string;
    name: string;
    monthlyBudget: string | null;
  }[];
  payees: {
    id: string;
    tenantId: string;
    type: 'VENDOR' | 'GROUND_STAFF';
    name: string;
    phone: string | null;
    notes: string | null;
  }[];
  entries: DemoSeedRow[];
  /** Key every receipt points at (one placeholder image shared by all). */
  receiptKey: string;
}

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

const MS_DAY = 86_400_000;
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);
const shift = (ymd: string, days: number) =>
  ymdOf(new Date(dbDate(ymd).getTime() + days * MS_DAY));
const monthShift = (ymd: string, months: number, day: number) => {
  const d = dbDate(ymd);
  const t = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, day),
  );
  return ymdOf(t);
};
/** Nudge a Sunday to the Monday after. */
const schoolDay = (ymd: string) =>
  dbDate(ymd).getUTCDay() === 0 ? shift(ymd, 1) : ymd;
const atIst = (ymd: string, hh: number) =>
  new Date(dbDate(ymd).getTime() + (hh - 5.5) * 3_600_000);
const rupees = (n: number) => n.toFixed(2);

export function buildDemoPettyCash(
  people: DemoPeople,
  today: string,
): DemoPettyCash {
  const rand = rng(20261019);
  const { tenantId, adminId, accountantId } = people;
  const [t1, t2, t3] = people.teacherIds;
  const receiptKey = `private/${tenantId}/petty-cash/demo-receipt.png`;
  const threshold = Number(DEMO_SETTINGS.approvalThreshold);
  const receiptAbove = Number(DEMO_SETTINGS.receiptRequiredAbove);

  const categories = DEFAULT_CATEGORIES.map((name) => ({
    id: randomUUID(),
    tenantId,
    name,
    monthlyBudget: BUDGETS[name],
  }));
  const cat = (name: (typeof DEFAULT_CATEGORIES)[number]) =>
    categories.find((c) => c.name === name)!.id;

  const payee = (
    type: 'VENDOR' | 'GROUND_STAFF',
    name: string,
    phone: string | null,
    notes: string | null,
  ) => ({
    id: randomUUID(),
    tenantId,
    type,
    name,
    phone,
    notes,
  });
  const payees = [
    payee(
      'VENDOR',
      'Sri Ganesh Stationers',
      '+91 98450 11122',
      'Notebooks, chart paper, markers',
    ),
    payee(
      'VENDOR',
      'Lakshmi Electricals',
      '+91 98450 33344',
      'Bulbs, switches, small repairs',
    ),
    payee(
      'VENDOR',
      'Sai Caterers',
      '+91 98450 55566',
      'Snacks for events and meetings',
    ),
    payee(
      'GROUND_STAFF',
      'Ramesh Gowda',
      '+91 98450 77788',
      'Gardener and caretaker',
    ),
    payee('GROUND_STAFF', 'Shankar', null, 'Part-time helper'),
  ];
  const ramesh = payees[3].id;
  const sai = payees[2].id;

  const entries: DemoSeedRow[] = [];

  const base = (
    over: Partial<DemoSeedRow> &
      Pick<DemoSeedRow, 'type' | 'amount' | 'description'> & { day: string },
  ): DemoSeedRow => {
    const { day, ...rest } = over;
    const amt = Number(rest.amount);
    const needsAdmin = amt > threshold;
    return {
      id: randomUUID(),
      tenantId,
      date: dbDate(day),
      categoryId: null,
      receiptKey:
        rest.type === 'EXPENSE' && amt > receiptAbove ? receiptKey : null,
      recipientUserId: null,
      payeeId: null,
      settlesEntryId: null,
      status: 'APPROVED',
      createdBy: accountantId,
      approvedBy: needsAdmin ? adminId : null,
      approvedAt: needsAdmin ? atIst(shift(day, 1), 11) : null,
      rejectionReason: null,
      voidReason: null,
      voidedBy: null,
      voidedAt: null,
      createdAt: atIst(day, 10),
      ...rest,
    };
  };

  const add = (row: DemoSeedRow) => entries.push(row);

  const monthDay = (k: number, day: number) =>
    schoolDay(monthShift(today, k, day));
  const past = (ymd: string) => ymd <= today;

  // Five complete months (k = -5 .. -1) plus the month in progress (k = 0).
  const STATIONERY_TOTAL = [1800, 2100, 2600, 3300, 4100];
  const STATIONERY_COUNT = [4, 5, 9, 10, 12]; // many small purchases lately: a bulk-buy candidate
  const REPAIRS = [[3500], [], [2400, 2800], [2800], [4500]];
  const REFRESH = [1500, 1200, 1800, 1600, 1900];
  const TRANSPORT = [800, 1000, 900, 1100, 1000];
  const EVENTS = [
    [],
    [1200, 900, 1300],
    [1000, 1500],
    [800, 1000, 1200],
    [5600, 1100, 900],
  ]; // last month has one big outlier
  const MISC = [600, 900, 400, 1000, 700];
  const LATE_DELAY = [11, 9, 3, 12, 10]; // teacher 3 settles late most months
  const ADVANCE_AMOUNTS = [2200, 1800, 2400, 2000, 2600];

  for (let m = 0; m < 5; m++) {
    const k = m - 5;
    // Opening float in the first month, then a regular top-up on the first working days.
    add(
      base({
        type: 'TOP_UP',
        amount: rupees(m === 0 ? 26000 : 17000),
        day: monthDay(k, 1),
        description: 'Petty cash top-up from the school office',
      }),
    );

    // Stationery: many small buys.
    let remaining = STATIONERY_TOTAL[m];
    for (let i = 0; i < STATIONERY_COUNT[m]; i++) {
      const left = STATIONERY_COUNT[m] - i;
      const amount =
        left === 1
          ? remaining
          : Math.max(
              60,
              Math.round(((remaining / left) * (0.8 + rand() * 0.4)) / 10) * 10,
            );
      remaining -= amount;
      add(
        base({
          type: 'EXPENSE',
          amount: rupees(amount),
          day: monthDay(k, 2 + i * 2),
          categoryId: cat('Stationery'),
          description: i % 2 ? 'Notebooks and pens' : 'Chart paper and markers',
        }),
      );
    }
    for (const [i, amount] of REPAIRS[m].entries())
      add(
        base({
          type: 'EXPENSE',
          amount: rupees(amount),
          day: monthDay(k, 8 + i * 6),
          categoryId: cat('Repairs & Maintenance'),
          description:
            i % 2 ? 'Classroom fan repair' : 'Plumbing repair in washroom',
        }),
      );
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(REFRESH[m]),
        day: monthDay(k, 12),
        categoryId: cat('Refreshments'),
        description: 'Tea and snacks for staff meeting',
      }),
    );
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(TRANSPORT[m]),
        day: monthDay(k, 15),
        categoryId: cat('Transport'),
        description: 'Auto fare for bank and office errands',
      }),
    );
    for (const [i, amount] of EVENTS[m].entries())
      add(
        base({
          type: 'EXPENSE',
          amount: rupees(amount),
          day: monthDay(k, 12 + i * 4),
          categoryId: cat('Events'),
          description:
            amount > 5000
              ? 'Annual day stage decoration'
              : 'Event decorations and prizes',
        }),
      );
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(MISC[m]),
        day: monthDay(k, 22),
        categoryId: cat('Miscellaneous'),
        description: 'Courier and photocopy charges',
      }),
    );

    // An advance to a teacher for an event, settled with an expense and (some months) a return.
    const adv = ADVANCE_AMOUNTS[m];
    const who = LATE_DELAY[m] > DEMO_SETTINGS.overdueDays ? t3 : t2;
    const dDay = monthDay(k, 4);
    const disb = base({
      type: 'DISBURSEMENT',
      amount: rupees(adv),
      day: dDay,
      categoryId: cat('Refreshments'),
      recipientUserId: who,
      description: 'Snacks and materials for the class activity day',
    });
    add(disb);
    const settleDay = schoolDay(shift(dDay, LATE_DELAY[m]));
    const giveBack = m % 2 === 0 ? 150 : 0;
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(adv - giveBack),
        day: settleDay,
        categoryId: cat('Refreshments'),
        settlesEntryId: disb.id,
        description: 'Activity day snacks, bill submitted',
      }),
    );
    if (giveBack)
      add(
        base({
          type: 'RETURN',
          amount: rupees(giveBack),
          day: settleDay,
          settlesEntryId: disb.id,
          description: 'Unspent cash returned',
        }),
      );

    // Ground staff advance, settled within three days.
    const gDay = monthDay(k, 18);
    const gAmt = 1000 + 250 * (m % 4);
    const g = base({
      type: 'DISBURSEMENT',
      amount: rupees(gAmt),
      day: gDay,
      categoryId: cat('Repairs & Maintenance'),
      payeeId: ramesh,
      description: 'Garden tools and cleaning supplies',
    });
    add(g);
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(gAmt),
        day: schoolDay(shift(gDay, 3)),
        categoryId: cat('Repairs & Maintenance'),
        settlesEntryId: g.id,
        description: 'Garden tools and cleaning supplies, bill submitted',
      }),
    );
  }

  // Month in progress: top-up, a couple of purchases and two open advances (one overdue).
  const firstOfMonth = monthDay(0, 1);
  if (past(firstOfMonth))
    add(
      base({
        type: 'TOP_UP',
        amount: rupees(12000),
        day: firstOfMonth,
        description: 'Petty cash top-up from the school office',
      }),
    );
  const early = monthDay(0, 2);
  if (past(early))
    add(
      base({
        type: 'EXPENSE',
        amount: rupees(1500),
        day: early,
        categoryId: cat('Stationery'),
        description: 'Notebooks and pens',
      }),
    );

  const overdueDay = shift(today, -12);
  const recentDay = shift(today, -2);
  const overdue = base({
    type: 'DISBURSEMENT',
    amount: rupees(2800),
    day: overdueDay,
    categoryId: cat('Events'),
    recipientUserId: t3,
    description: 'Props for the school exhibition',
  });
  const recent = base({
    type: 'DISBURSEMENT',
    amount: rupees(1200),
    day: recentDay,
    categoryId: cat('Refreshments'),
    payeeId: sai,
    description: 'Snacks for the parents meeting',
  });
  add(overdue);
  add(
    base({
      type: 'EXPENSE',
      amount: rupees(900),
      day: shift(today, -9),
      categoryId: cat('Events'),
      settlesEntryId: overdue.id,
      description: 'Part payment of props, bill submitted',
    }),
  );
  add(recent);

  // A rejected and a voided entry, kept in the ledger with their reasons.
  entries.push(
    base({
      type: 'EXPENSE',
      amount: rupees(2600),
      day: shift(today, -20),
      categoryId: cat('Miscellaneous'),
      description: 'Gift hamper for a visitor',
      status: 'REJECTED',
      approvedBy: adminId,
      approvedAt: atIst(shift(today, -19), 12),
      rejectionReason:
        'Not a petty cash expense, raise it through the office budget',
    }),
    base({
      type: 'EXPENSE',
      amount: rupees(350),
      day: shift(today, -6),
      categoryId: cat('Stationery'),
      description: 'Notebooks and pens',
      status: 'VOIDED',
      voidReason: 'Entered twice by mistake',
      voidedBy: accountantId,
      voidedAt: atIst(shift(today, -5), 11),
    }),
  );

  // One entry waiting for the admin (above the threshold, so it affects nothing yet).
  entries.push(
    base({
      type: 'DISBURSEMENT',
      amount: rupees(6500),
      day: shift(today, -1),
      categoryId: cat('Events'),
      recipientUserId: t1,
      description: 'Advance for annual day costumes',
      status: 'PENDING',
      approvedBy: null,
      approvedAt: null,
    }),
  );

  entries.sort(
    (a, b) =>
      a.date.getTime() - b.date.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return {
    settings: { tenantId, categoriesSeeded: true, ...DEMO_SETTINGS },
    categories,
    payees,
    entries,
    receiptKey,
  };
}
