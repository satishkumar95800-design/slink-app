/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake and plain seed rows */
/**
 * A small in-memory stand-in for PrismaService, just rich enough for the HR
 * services: where-matching (equality, in, not, gte/lte/gt/lt, contains,
 * startsWith, OR/AND), relation includes by foreign key, nested item creates.
 * Not a general Prisma emulator; extend it only as specs need.
 */

type Row = Record<string, any>;

/** model -> relation name -> [target model, local foreign-key field] */
const RELATIONS: Record<string, Record<string, [string, string]>> = {
  leaveRequest: {
    leaveType: ['leaveType', 'leaveTypeId'],
    employee: ['employee', 'employeeId'],
  },
  employee: { user: ['user', 'userId'] },
  staffAttendance: { leaveRequest: ['leaveRequest', 'leaveRequestId'] },
  payRunLine: { payRun: ['payRun', 'payRunId'] },
};

/** model -> children relation name -> [child model, child foreign key] */
const CHILDREN: Record<string, Record<string, [string, string]>> = {
  payRunLine: { items: ['payRunLineItem', 'lineId'] },
};

const DEFAULTS: Record<string, () => Row> = {
  employee: () => ({
    status: 'ACTIVE',
    employmentType: 'PERMANENT',
    exitDate: null,
    exitReason: null,
    userId: null,
    phone: null,
    email: null,
    department: null,
    panEnc: null,
    aadhaarEnc: null,
    uanEnc: null,
    esiNumberEnc: null,
    bankAccountEnc: null,
    bankIfscEnc: null,
    bankHolderEnc: null,
    sensitiveHints: {},
  }),
  leaveRequest: () => ({
    status: 'PENDING',
    halfDay: false,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  }),
  leaveType: () => ({ isActive: true, carryForwardCap: 0 }),
  staffAttendance: () => ({ note: null, leaveRequestId: null }),
  payRun: () => ({
    status: 'DRAFT',
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    selfApproved: false,
    lockedBy: null,
    lockedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelReason: null,
    paidAt: null,
    paidBy: null,
    paymentReference: null,
  }),
  payRunLine: () => ({
    department: null,
    unmarkedDays: 0,
    employerPf: 0,
    employerEsi: 0,
    flags: [],
    bankAccountEnc: null,
    bankIfscEnc: null,
    bankHolderEnc: null,
  }),
  payRunLineItem: () => ({ code: null, reason: null, createdBy: null }),
  hrSetting: () => ({
    weeklyOffDays: [0],
    workingDaysRule: 'CALENDAR',
    treatUnmarkedAsAbsent: false,
    leaveYearStartMonth: 4,
    pfEnabled: true,
    pfEmployeeRate: 12,
    pfEmployerRate: 12,
    pfWageCeiling: 15000,
    esiEnabled: true,
    esiEmployeeRate: 0.75,
    esiEmployerRate: 3.25,
    esiWageCeiling: 21000,
    ptEnabled: true,
    ptSlabs: [],
    slabsSeeded: false,
  }),
};

const cmp = (a: any, b: any): number => {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  return av < bv ? -1 : av > bv ? 1 : 0;
};
const eq = (a: any, b: any) =>
  a == null || b == null ? a == null && b == null : cmp(a, b) === 0;

/** Sort by orderBy ({ k: 'asc' } or an array of those); nested keys are ignored. */
const sortRows = (rows: Row[], orderBy?: Row | Row[]) => {
  const keys = ([] as Row[]).concat(orderBy ?? []);
  if (!keys.length) return rows;
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const [field, dir] = Object.entries(k)[0];
      if (typeof dir !== 'string') continue;
      const c = cmp(a[field], b[field]);
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
};

export function createDb(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  let seq = 0;
  const table = (m: string) => (tables[m] ??= []);
  for (const [m, rows] of Object.entries(seed)) table(m).push(...rows);

  const joined = (model: string, row: Row, include?: Row) => {
    if (!row) return row;
    const out: Row = { ...row };
    for (const [name, spec] of Object.entries(include ?? {})) {
      if (!spec) continue;
      const rel = RELATIONS[model]?.[name];
      if (rel) {
        const [target, fk] = rel;
        out[name] = table(target).find((r) => r.id === row[fk]) ?? null;
        continue;
      }
      const child = CHILDREN[model]?.[name];
      if (child) {
        const [cm, fk] = child;
        let kids = table(cm).filter((r) => r[fk] === row.id);
        const w = (spec as Row).where;
        if (w) kids = kids.filter((r) => matches(cm, r, w));
        out[name] = kids;
      }
    }
    return out;
  };

  const matches = (model: string, row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (k === 'OR') return (v as Row[]).some((w) => matches(model, row, w));
      if (k === 'AND') return (v as Row[]).every((w) => matches(model, row, w));
      const rel = RELATIONS[model]?.[k];
      if (rel && v && typeof v === 'object') {
        const target = table(rel[0]).find((r) => r.id === row[rel[1]]);
        return !!target && matches(rel[0], target, v as Row);
      }
      if (k === 'employee' && v === null)
        return !table('employee').some((e) => e.userId === row.id);
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const ci = (v as Row).mode === 'insensitive';
        const norm = (x: any) =>
          ci && typeof x === 'string' ? x.toLowerCase() : x;
        const cur = norm(row[k]);
        return Object.entries(v as Row).every(([op, arg]) => {
          switch (op) {
            case 'mode':
              return true;
            case 'in':
              return (arg as any[]).some((a) => eq(a, row[k]));
            case 'not':
              return arg && typeof arg === 'object' && !(arg instanceof Date)
                ? !matches(model, { [k]: row[k] }, { [k]: arg })
                : !eq(arg, row[k]);
            case 'gte':
              return row[k] != null && cmp(row[k], arg) >= 0;
            case 'lte':
              return row[k] != null && cmp(row[k], arg) <= 0;
            case 'gt':
              return row[k] != null && cmp(row[k], arg) > 0;
            case 'lt':
              return row[k] != null && cmp(row[k], arg) < 0;
            case 'equals':
              return cur === norm(arg);
            case 'contains':
              return typeof cur === 'string' && cur.includes(norm(arg));
            case 'startsWith':
              return typeof cur === 'string' && cur.startsWith(norm(arg));
            default:
              return true;
          }
        });
      }
      return eq(row[k], v);
    });

  const create = (model: string, data: Row, include?: Row) => {
    const { items, ...rest } = data;
    const row: Row = {
      id: `${model}-${++seq}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(DEFAULTS[model]?.() ?? {}),
      ...rest,
    };
    table(model).push(row);
    if (items?.create) {
      for (const it of items.create)
        create('payRunLineItem', { ...it, lineId: row.id });
    }
    return joined(model, row, include);
  };

  const uniqueKeyFind = (model: string, where: Row) => {
    // compound unique like { employeeId_date: { employeeId, date } }
    const flat: Row = {};
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && k.includes('_'))
        Object.assign(flat, v);
      else flat[k] = v;
    }
    return table(model).find((r) => matches(model, r, flat));
  };

  const delegate = (model: string) => ({
    create: jest.fn(({ data, include }: Row) =>
      Promise.resolve(create(model, data, include)),
    ),
    createMany: jest.fn(({ data }: Row) => {
      for (const d of data) create(model, d);
      return Promise.resolve({ count: data.length });
    }),
    findMany: jest.fn(({ where, include, take, orderBy }: Row = {}) => {
      let rows = sortRows(
        table(model).filter((r) => matches(model, r, where)),
        orderBy,
      );
      if (take) rows = rows.slice(0, take);
      return Promise.resolve(rows.map((r) => joined(model, r, include)));
    }),
    findFirst: jest.fn(({ where, include, orderBy }: Row = {}) => {
      const r = sortRows(table(model), orderBy).find((x) =>
        matches(model, x, where),
      );
      return Promise.resolve(r ? joined(model, r, include) : null);
    }),
    findFirstOrThrow: jest.fn(({ where, include }: Row = {}) => {
      const r = table(model).find((x) => matches(model, x, where));
      return r
        ? Promise.resolve(joined(model, r, include))
        : Promise.reject(new Error('not found'));
    }),
    findUnique: jest.fn(({ where, include }: Row = {}) => {
      const r = uniqueKeyFind(model, where);
      return Promise.resolve(r ? joined(model, r, include) : null);
    }),
    count: jest.fn(({ where }: Row = {}) =>
      Promise.resolve(
        table(model).filter((r) => matches(model, r, where)).length,
      ),
    ),
    update: jest.fn(({ where, data, include }: Row) => {
      const r = uniqueKeyFind(model, where);
      if (!r) return Promise.reject(new Error('not found'));
      Object.assign(r, data, { updatedAt: new Date() });
      return Promise.resolve(joined(model, r, include));
    }),
    upsert: jest.fn(({ where, create: c, update: u }: Row) => {
      const r = uniqueKeyFind(model, where);
      if (r) {
        Object.assign(r, u);
        return Promise.resolve(r);
      }
      return Promise.resolve(create(model, c));
    }),
    delete: jest.fn(({ where }: Row) => {
      const t = table(model);
      const i = t.findIndex((r) => matches(model, r, where));
      if (i >= 0) t.splice(i, 1);
      return Promise.resolve({});
    }),
    deleteMany: jest.fn(({ where }: Row = {}) => {
      const t = table(model);
      const keep = t.filter((r) => !matches(model, r, where));
      const count = t.length - keep.length;
      tables[model] = keep;
      // cascade payRunLine -> items
      if (model === 'payRunLine') {
        const ids = new Set(keep.map((r) => r.id));
        tables.payRunLineItem = table('payRunLineItem').filter((i) =>
          ids.has(i.lineId),
        );
      }
      return Promise.resolve({ count });
    }),
    groupBy: jest.fn(() => Promise.resolve([])),
  });

  const models = [
    'tenant',
    'user',
    'employee',
    'employeeDocument',
    'staffAttendance',
    'leaveType',
    'leaveRequest',
    'salaryStructure',
    'payRun',
    'payRunLine',
    'payRunLineItem',
    'hrSetting',
    'schoolHoliday',
    'auditLog',
    'pettyCashPayee',
    'notification',
  ];
  const prisma: Row = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  for (const m of models) prisma[m] = delegate(m);
  // tenant is read by findUnique({ where: { id } }) in a few places
  return { prisma, tables, table: table as (m: string) => any[], create };
}
