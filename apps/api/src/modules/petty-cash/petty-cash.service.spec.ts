/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake and jest mock calls */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PettyCashService } from './petty-cash.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import type { CreateEntryDto } from './dto/petty-cash.dto';

const TENANT = 'tenant-a';
const OTHER = 'tenant-b';
const user = (role: Role, id = `${role}-1`, tenantId = TENANT): ActiveUser => ({
  id,
  role,
  tenantId,
  name: id,
  isVerified: true,
});
const ACCOUNTS = user(Role.accounts);
const ADMIN = user(Role.admin);

const CAT = '00000000-0000-4000-8000-0000000000c1';
const STAFF = '00000000-0000-4000-8000-0000000000a1';
const PAYEE = '00000000-0000-4000-8000-0000000000b1';
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

type Row = Record<string, any>;

/** Tiny in-memory Prisma: just enough where-matching for the ledger rules. */
function setup(
  over: {
    threshold?: string;
    receiptAbove?: string;
    overdueDays?: number;
  } = {},
) {
  const entries: Row[] = [];
  let seq = 0;
  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(row[k]);
        return true;
      }
      return row[k] === v;
    });
  const withIncludes = (r: Row) => ({
    category: null,
    payee: null,
    recipientUser: null,
    ...r,
  });

  const audit: Row[] = [];
  const prisma: Row = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ timezone: 'Asia/Kolkata', defaultLanguage: 'en' }),
    },
    pettyCashSetting: {
      findUnique: jest.fn().mockResolvedValue({
        tenantId: TENANT,
        approvalThreshold: over.threshold ?? '2000',
        monthlyBudget: null,
        receiptRequiredAbove: over.receiptAbove ?? '500',
        overdueDays: over.overdueDays ?? 7,
        categoriesSeeded: true,
      }),
    },
    pettyCashCategory: {
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          where.id === CAT && where.tenantId === TENANT ? { id: CAT } : null,
        ),
      ),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: CAT, name: 'Stationery', monthlyBudget: null, isActive: true },
        ]),
    },
    pettyCashPayee: {
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          where.id === PAYEE && where.tenantId === TENANT
            ? { id: PAYEE }
            : null,
        ),
      ),
    },
    user: {
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          where.id === STAFF && where.tenantId === TENANT
            ? { id: STAFF }
            : null,
        ),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    pettyCashEntry: {
      create: jest.fn(({ data }: Row) => {
        const row = {
          id: `e${++seq}`,
          createdAt: new Date(),
          approvedBy: null,
          approvedAt: null,
          ...data,
          date: data.date,
        };
        entries.push(row);
        return Promise.resolve(withIncludes(row));
      }),
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(entries.find((e) => matches(e, where)) ?? null),
      ),
      findMany: jest.fn(({ where }: Row) =>
        Promise.resolve(
          entries.filter((e) => matches(e, where)).map(withIncludes),
        ),
      ),
      update: jest.fn(({ where, data }: Row) => {
        const row = entries.find((e) => e.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(withIncludes(row));
      }),
      count: jest.fn(({ where }: Row) =>
        Promise.resolve(entries.filter((e) => matches(e, where)).length),
      ),
    },
    auditLog: {
      create: jest.fn(
        ({ data }: Row) => (audit.push(data), Promise.resolve(data)),
      ),
    },
  };
  const files = { getSignedUrl: jest.fn(), upload: jest.fn() };
  const service = new PettyCashService(prisma as never, files as never);

  /** Seed an APPROVED row directly. */
  const seed = (r: Row) =>
    entries.push({
      tenantId: TENANT,
      status: 'APPROVED',
      date: day('2026-09-01'),
      settlesEntryId: null,
      recipientUserId: null,
      payeeId: null,
      categoryId: null,
      createdBy: 'seed',
      description: 'seed',
      createdAt: new Date(),
      ...r,
      id: (r.id as string | undefined) ?? `s${++seq}`,
    });
  return { prisma, entries, audit, service, seed, files };
}

const dto = (over: Partial<CreateEntryDto>): CreateEntryDto => ({
  type: 'TOP_UP',
  amount: 1000,
  date: '2026-09-10',
  description: 'test',
  ...over,
});

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2026-10-15T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('PettyCashService', () => {
  describe('approval gate', () => {
    it('approves at or below the threshold immediately, with no reviewer', async () => {
      const { service } = setup();
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 2000 }),
      );
      expect(e.status).toBe('APPROVED');
      expect(e.reviewedBy).toBeNull();
    });

    it('holds an accountant entry above the threshold as PENDING and it affects nothing', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'TOP_UP', amount: 2000.01 }),
      );
      expect(e.status).toBe('PENDING');
      expect((await service.summary(TENANT)).balance).toBe('5000.00');
    });

    it('lets an admin self-approve above the threshold and records it in the audit log', async () => {
      const { service, audit } = setup();
      const e = await service.createEntry(TENANT, ADMIN, dto({ amount: 9000 }));
      expect(e.status).toBe('APPROVED');
      expect(e.reviewedBy?.id).toBe(ADMIN.id);
      expect(audit[0]).toMatchObject({
        action: 'petty_cash.entry.create',
        diff: expect.objectContaining({
          selfApproved: true,
          thresholdExceeded: true,
        }),
      });
    });

    it('applies a pending entry on approval', async () => {
      const { service } = setup();
      const pending = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      expect((await service.summary(TENANT)).balance).toBe('0.00');
      const approved = await service.approve(TENANT, pending.id, ADMIN);
      expect(approved.status).toBe('APPROVED');
      expect((await service.summary(TENANT)).balance).toBe('9000.00');
    });

    it('refuses approval by a non-admin and by the entry creator', async () => {
      const { service } = setup();
      const pending = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      await expect(
        service.approve(TENANT, pending.id, ACCOUNTS),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const own = user(Role.admin, ACCOUNTS.id);
      await expect(
        service.approve(TENANT, pending.id, own),
      ).rejects.toMatchObject({
        response: { code: 'SELF_APPROVAL' },
      });
    });

    it('cannot approve or reject twice', async () => {
      const { service } = setup();
      const pending = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      await service.reject(TENANT, pending.id, 'not needed', ADMIN);
      await expect(
        service.approve(TENANT, pending.id, ADMIN),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejection keeps the reason and changes nothing', async () => {
      const { service } = setup();
      const pending = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      const r = await service.reject(TENANT, pending.id, 'duplicate', ADMIN);
      expect(r).toMatchObject({
        status: 'REJECTED',
        rejectionReason: 'duplicate',
      });
      expect((await service.summary(TENANT)).balance).toBe('0.00');
    });

    it('re-checks the float when approving', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '3000' });
      const big = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'EXPENSE',
          amount: 2500,
          categoryId: CAT,
          receiptKey: `private/${TENANT}/petty-cash/x.pdf`,
        }),
      );
      expect(big.status).toBe('PENDING');
      // Float drops below the pending amount before the admin gets to it.
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'DISBURSEMENT', amount: 1500, recipientUserId: STAFF }),
      );
      await expect(
        service.approve(TENANT, big.id, ADMIN),
      ).rejects.toMatchObject({
        response: { code: 'INSUFFICIENT_FLOAT' },
      });
    });
  });

  describe('float', () => {
    it('refuses an entry that would take the float below zero', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '1000' });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({
            type: 'DISBURSEMENT',
            amount: 1000.01,
            recipientUserId: STAFF,
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_FLOAT' } });
      const ok = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'DISBURSEMENT', amount: 1000, recipientUserId: STAFF }),
      );
      expect(ok.status).toBe('APPROVED');
      expect((await service.summary(TENANT)).balance).toBe('0.00');
    });

    it('derives the balance from approved entries only', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '10000' });
      seed({ type: 'EXPENSE', amount: '250.50', categoryId: CAT });
      seed({ type: 'EXPENSE', amount: '999', status: 'VOIDED' });
      seed({ type: 'TOP_UP', amount: '777', status: 'PENDING' });
      expect((await service.summary(TENANT)).balance).toBe('9749.50');
    });
  });

  describe('recipient and shape rules', () => {
    it('requires exactly one of staff user or payee on a disbursement', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      await expect(
        service.createEntry(TENANT, ACCOUNTS, dto({ type: 'DISBURSEMENT' })),
      ).rejects.toMatchObject({
        response: { code: 'RECIPIENT_REQUIRED' },
      });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'DISBURSEMENT', recipientUserId: STAFF, payeeId: PAYEE }),
        ),
      ).rejects.toMatchObject({ response: { code: 'RECIPIENT_EXACTLY_ONE' } });
      const withPayee = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'DISBURSEMENT', payeeId: PAYEE }),
      );
      expect(withPayee.status).toBe('APPROVED');
    });

    it('rejects a recipient on a top-up or settling entry', async () => {
      const { service } = setup();
      await expect(
        service.createEntry(TENANT, ACCOUNTS, dto({ recipientUserId: STAFF })),
      ).rejects.toMatchObject({
        response: { code: 'RECIPIENT_NOT_ALLOWED' },
      });
    });

    it('requires a category on an expense and a receipt above the limit', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      await expect(
        service.createEntry(TENANT, ACCOUNTS, dto({ type: 'EXPENSE' })),
      ).rejects.toMatchObject({
        response: { code: 'CATEGORY_REQUIRED' },
      });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'EXPENSE', categoryId: CAT, amount: 500.01 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'RECEIPT_REQUIRED' } });
      const ok = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'EXPENSE', categoryId: CAT, amount: 500 }),
      );
      expect(ok.status).toBe('APPROVED');
    });

    it('only accepts receipts stored under this school', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({
            type: 'EXPENSE',
            categoryId: CAT,
            amount: 900,
            receiptKey: `private/${OTHER}/petty-cash/x.pdf`,
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'RECEIPT_KEY_INVALID' } });
    });

    it('rejects future dates', async () => {
      const { service } = setup();
      await expect(
        service.createEntry(TENANT, ACCOUNTS, dto({ date: '2026-10-16' })),
      ).rejects.toThrow();
    });
  });

  describe('settlement', () => {
    const open = (seed: ReturnType<typeof setup>['seed']) => {
      seed({ type: 'TOP_UP', amount: '10000' });
      seed({
        id: 'disb',
        type: 'DISBURSEMENT',
        amount: '1000',
        recipientUserId: STAFF,
        date: day('2026-10-01'),
      });
    };

    it('settles with expenses and returns until the advance is closed', async () => {
      const { service, seed } = setup();
      open(seed);
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'EXPENSE',
          amount: 400,
          categoryId: CAT,
          settlesEntryId: 'disb',
          date: '2026-10-05',
        }),
      );
      let adv = await service.listAdvances(TENANT, {});
      expect(adv[0]).toMatchObject({
        settled: '400.00',
        outstanding: '600.00',
      });
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'RETURN',
          amount: 600,
          settlesEntryId: 'disb',
          date: '2026-10-06',
        }),
      );
      adv = await service.listAdvances(TENANT, {});
      expect(adv).toHaveLength(0);
    });

    it('leaves the float alone for a settling expense but restores it for a return', async () => {
      const { service, seed } = setup();
      open(seed);
      expect((await service.summary(TENANT)).balance).toBe('9000.00');
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'EXPENSE',
          amount: 400,
          categoryId: CAT,
          settlesEntryId: 'disb',
          date: '2026-10-05',
        }),
      );
      expect((await service.summary(TENANT)).balance).toBe('9000.00');
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'RETURN',
          amount: 100,
          settlesEntryId: 'disb',
          date: '2026-10-06',
        }),
      );
      expect((await service.summary(TENANT)).balance).toBe('9100.00');
    });

    it('cannot over-settle', async () => {
      const { service, seed } = setup();
      open(seed);
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({
            type: 'EXPENSE',
            amount: 1000.01,
            categoryId: CAT,
            settlesEntryId: 'disb',
            date: '2026-10-05',
            receiptKey: `private/${TENANT}/petty-cash/x.pdf`,
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'OVER_SETTLE' } });
    });

    it('cannot settle before the disbursement date or against a pending/unknown disbursement', async () => {
      const { service, seed } = setup();
      open(seed);
      seed({
        id: 'pend',
        type: 'DISBURSEMENT',
        amount: '500',
        recipientUserId: STAFF,
        status: 'PENDING',
      });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({
            type: 'RETURN',
            amount: 10,
            settlesEntryId: 'disb',
            date: '2026-09-30',
          }),
        ),
      ).rejects.toMatchObject({
        response: { code: 'SETTLE_BEFORE_DISBURSEMENT' },
      });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({
            type: 'RETURN',
            amount: 10,
            settlesEntryId: 'pend',
            date: '2026-10-05',
          }),
        ),
      ).rejects.toMatchObject({ response: { code: 'SETTLES_NOT_FOUND' } });
    });

    it('reports an advance as overdue after the configured days', async () => {
      const { service, seed } = setup({ overdueDays: 7 });
      open(seed); // disbursed 2026-10-01, today 2026-10-15
      const s = await service.summary(TENANT);
      expect(s.openAdvances).toEqual({ count: 1, outstanding: '1000.00' });
      expect(s.overdueAdvances).toEqual({ count: 1, outstanding: '1000.00' });
      const [a] = await service.listAdvances(TENANT, { status: 'overdue' });
      expect(a).toMatchObject({ ageDays: 14, overdue: true });
    });

    it('does not count pending settlements until approved', async () => {
      const { service, seed } = setup({ threshold: '100' });
      open(seed);
      const pending = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({
          type: 'RETURN',
          amount: 1000,
          settlesEntryId: 'disb',
          date: '2026-10-05',
        }),
      );
      expect(pending.status).toBe('PENDING');
      expect((await service.listAdvances(TENANT, {}))[0].outstanding).toBe(
        '1000.00',
      );
      await service.approve(TENANT, pending.id, ADMIN);
      expect(await service.listAdvances(TENANT, {})).toHaveLength(0);
    });
  });

  describe('void (append-only corrections)', () => {
    it('keeps the row with its reason and reverses the effect', async () => {
      const { service, entries } = setup();
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 1500 }),
      );
      const v = await service.voidEntry(
        TENANT,
        e.id,
        'entered twice',
        ACCOUNTS,
      );
      expect(v).toMatchObject({
        status: 'VOIDED',
        voidReason: 'entered twice',
      });
      expect(entries).toHaveLength(1);
      expect((await service.summary(TENANT)).balance).toBe('0.00');
    });

    it('needs an admin to void an approved entry above the threshold', async () => {
      const { service } = setup();
      const e = await service.createEntry(TENANT, ADMIN, dto({ amount: 9000 }));
      await expect(
        service.voidEntry(TENANT, e.id, 'mistake', ACCOUNTS),
      ).rejects.toMatchObject({
        response: { code: 'VOID_NEEDS_APPROVER' },
      });
      await expect(
        service.voidEntry(TENANT, e.id, 'mistake', ADMIN),
      ).resolves.toMatchObject({ status: 'VOIDED' });
    });

    it('refuses a void that would overdraw the float', async () => {
      const { service, seed } = setup();
      seed({ id: 'top', type: 'TOP_UP', amount: '1000' });
      await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ type: 'DISBURSEMENT', amount: 800, recipientUserId: STAFF }),
      );
      await expect(
        service.voidEntry(TENANT, 'top', 'oops', ACCOUNTS),
      ).rejects.toMatchObject({
        response: { code: 'INSUFFICIENT_FLOAT' },
      });
    });

    it('refuses to void a disbursement that has settlements', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      seed({
        id: 'disb',
        type: 'DISBURSEMENT',
        amount: '1000',
        recipientUserId: STAFF,
      });
      seed({ type: 'RETURN', amount: '100', settlesEntryId: 'disb' });
      await expect(
        service.voidEntry(TENANT, 'disb', 'oops', ADMIN),
      ).rejects.toMatchObject({
        response: { code: 'HAS_SETTLEMENTS' },
      });
    });

    it('lets only the creator or an admin withdraw a pending entry', async () => {
      const { service } = setup();
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      await expect(
        service.voidEntry(
          TENANT,
          e.id,
          'withdrawn',
          user(Role.accounts, 'other-accounts'),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.voidEntry(TENANT, e.id, 'withdrawn', ACCOUNTS),
      ).resolves.toMatchObject({ status: 'VOIDED' });
    });

    it('cannot void twice', async () => {
      const { service } = setup();
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 100 }),
      );
      await service.voidEntry(TENANT, e.id, 'first', ACCOUNTS);
      await expect(
        service.voidEntry(TENANT, e.id, 'again', ACCOUNTS),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('tenant isolation', () => {
    it('never touches another school entries', async () => {
      const { service, seed } = setup();
      seed({
        id: 'foreign',
        tenantId: OTHER,
        type: 'TOP_UP',
        amount: '9999',
        status: 'PENDING',
      });
      await expect(
        service.approve(TENANT, 'foreign', ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.voidEntry(TENANT, 'foreign', 'nope', ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.reject(TENANT, 'foreign', 'nope', ADMIN),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect((await service.summary(TENANT)).balance).toBe('0.00');
    });

    it('rejects a recipient, payee, category or disbursement from another school', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '5000' });
      seed({
        id: 'foreign-disb',
        tenantId: OTHER,
        type: 'DISBURSEMENT',
        amount: '100',
      });
      const foreign = '00000000-0000-4000-8000-0000000000ff';
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'DISBURSEMENT', recipientUserId: foreign }),
        ),
      ).rejects.toMatchObject({ response: { code: 'STAFF_NOT_FOUND' } });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'DISBURSEMENT', payeeId: foreign }),
        ),
      ).rejects.toMatchObject({ response: { code: 'PAYEE_NOT_FOUND' } });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'EXPENSE', categoryId: foreign, amount: 10 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'CATEGORY_NOT_FOUND' } });
      await expect(
        service.createEntry(
          TENANT,
          ACCOUNTS,
          dto({ type: 'RETURN', settlesEntryId: 'foreign-disb', amount: 10 }),
        ),
      ).rejects.toMatchObject({ response: { code: 'SETTLES_NOT_FOUND' } });
    });

    it('scopes every ledger query by tenant', async () => {
      const { service, prisma } = setup();
      await service.listEntries(TENANT, {});
      await service.summary(TENANT);
      for (const call of prisma.pettyCashEntry.findMany.mock.calls)
        expect(call[0].where.tenantId).toBe(TENANT);
    });
  });

  describe('audit', () => {
    it('writes an audit entry for every mutation', async () => {
      const { service, audit } = setup();
      const e = await service.createEntry(
        TENANT,
        ACCOUNTS,
        dto({ amount: 9000 }),
      );
      await service.approve(TENANT, e.id, ADMIN);
      await service.voidEntry(TENANT, e.id, 'wrong', ADMIN);
      expect(audit.map((a) => a.action)).toEqual([
        'petty_cash.entry.create',
        'petty_cash.entry.approve',
        'petty_cash.entry.void',
      ]);
      expect(audit.every((a) => a.tenantId === TENANT)).toBe(true);
    });
  });

  it('serialises float-changing writes with a per-school advisory lock', async () => {
    const { service, prisma } = setup();
    await service.createEntry(TENANT, ACCOUNTS, dto({ amount: 100 }));
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  describe('export', () => {
    it('neutralises spreadsheet formulas and quotes commas', async () => {
      const { service, seed } = setup();
      seed({ type: 'TOP_UP', amount: '100', description: '=HYPERLINK("x")' });
      seed({ type: 'TOP_UP', amount: '100', description: 'a, b' });
      const csv = await service.exportCsv(TENANT, {});
      expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
      expect(csv).toContain('"a, b"');
      expect(csv.split('\n')[0]).toContain('Amount (INR)');
    });
  });
});
