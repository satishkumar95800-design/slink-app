/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- in-memory Prisma fake */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { HeadOfficeService } from './head-office.service';

const HO: ActiveUser = {
  id: 'ho',
  role: Role.head_office,
  tenantId: 'b1',
  name: 'HO',
  isVerified: true,
};
type Row = Record<string, any>;
const branch = (
  id: string,
  plan: string,
  endsOn = '2027-10-16',
  groupId = 'g1',
): Row => ({
  id,
  name: id,
  slug: id,
  timezone: 'Asia/Kolkata',
  isActive: true,
  features: {},
  subscriptionPlan: plan,
  subscriptionEndsOn: new Date(`${endsOn}T00:00:00Z`),
  groupId,
  _count: { students: 100 },
});

function setup(
  userGroup: string | null = 'g1',
  opts: { classes?: number; markedClasses?: number; holiday?: boolean } = {},
) {
  const tenants = [
    branch('b1', 'premium'),
    branch('b2', 'basic'),
    branch('b3', 'premium', '2026-09-01'),
    branch('x', 'premium', '2027-10-16', 'g2'),
  ];
  const prisma: Row = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role: Role.head_office,
        group: userGroup
          ? { id: userGroup, name: 'Vidya Group', attendanceCutoff: '10:00' }
          : null,
      }),
      findMany: jest.fn().mockResolvedValue([{ id: 's1' }, { id: 's2' }]),
      groupBy: jest
        .fn()
        .mockResolvedValue([{ tenantId: 'b1', _count: { _all: 12 } }]),
    },
    tenant: {
      findMany: jest.fn(({ where }: Row) =>
        Promise.resolve(tenants.filter((t) => t.groupId === where.groupId)),
      ),
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          tenants.find(
            (t) => t.id === where.id && t.groupId === where.groupId,
          ) ?? null,
        ),
      ),
    },
    attendanceRecord: {
      groupBy: jest.fn(({ by }: Row) =>
        Promise.resolve(
          by.includes('classId') && by.includes('date')
            ? Array.from({ length: opts.markedClasses ?? 0 }, (_, i) => ({
                tenantId: 'b1',
                classId: `c${i}`,
                date: new Date('2026-10-17T00:00:00Z'),
              }))
            : [],
        ),
      ),
    },
    student: {
      groupBy: jest.fn().mockResolvedValue(
        Array.from({ length: opts.classes ?? 3 }, (_, i) => ({
          tenantId: 'b1',
          classId: `c${i}`,
        })),
      ),
    },
    schoolHoliday: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          opts.holiday
            ? [{ tenantId: 'b1', date: new Date('2026-10-17T00:00:00Z') }]
            : [],
        ),
    },
    groupCircular: {
      create: jest.fn(({ data }: Row) =>
        Promise.resolve({ id: 'circ1', ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    groupCircularBranch: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn() },
    broadcast: { groupBy: jest.fn().mockResolvedValue([]) },
    class: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  const notifications = {
    send: jest.fn().mockResolvedValue(undefined),
    broadcast: jest.fn().mockResolvedValue({ queued: 40 }),
  };
  return {
    service: new HeadOfficeService(prisma as never, notifications as never),
    prisma,
    notifications,
  };
}

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2026-10-17T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('HeadOfficeService', () => {
  it("shows only its own group's branches, with data only where the plan includes it and the school is on", async () => {
    const { service } = setup();
    const o = await service.overview(HO);
    expect(o.group?.name).toBe('Vidya Group');
    expect(o.branches.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    const by = Object.fromEntries(o.branches.map((b) => [b.id, b]));
    expect(by.b1).toMatchObject({
      available: true,
      metrics: { students: 100, staff: 12 },
    });
    expect(by.b2).toMatchObject({
      included: false,
      available: false,
      metrics: null,
    });
    expect(by.b3).toMatchObject({
      status: 'expired',
      available: false,
      metrics: null,
    });
    expect(o.totals).toMatchObject({
      branches: 3,
      available: 1,
      students: 100,
    });
  });

  it('answers 404 for a school outside the group', async () => {
    const { service } = setup();
    await expect(service.branch(HO, 'x')).rejects.toMatchObject({
      response: { code: 'BRANCH_NOT_IN_GROUP' },
    });
  });

  it('a login without a group sees nothing', async () => {
    const { service } = setup(null);
    expect(await service.overview(HO)).toEqual({
      group: null,
      totals: null,
      attendanceCutoff: null,
      branches: [],
    });
    await expect(service.branch(HO, 'b1')).rejects.toMatchObject({
      response: { code: 'BRANCH_NOT_IN_GROUP' },
    });
  });

  // 2026-10-17 06:00 UTC is 11:30 in India, past the 10:00 cutoff (a Saturday).
  it('flags a branch that has not marked attendance by the cutoff', async () => {
    const { service } = setup('g1', { classes: 3, markedClasses: 1 });
    const o = await service.overview(HO);
    const b1 = o.branches.find((b) => b.id === 'b1')!;
    expect(b1.metrics!.compliance).toEqual({
      state: 'late',
      classes: 3,
      notMarked: 2,
    });
    expect(o.totals!.lateAttendance).toBe(1);
  });

  it('is done when every class is marked, and quiet on a holiday', async () => {
    const done = await setup('g1', {
      classes: 2,
      markedClasses: 2,
    }).service.overview(HO);
    expect(done.branches[0].metrics!.compliance.state).toBe('done');
    const off = await setup('g1', {
      classes: 2,
      holiday: true,
    }).service.overview(HO);
    expect(off.branches[0].metrics!.compliance.state).toBe('holiday');
  });

  it('sends a circular only to branches that can receive it, staff and parents', async () => {
    const { service, prisma, notifications } = setup();
    await service.createCircular(HO, {
      title: 'Holiday',
      body: 'Closed on Monday',
      audience: 'staff_and_parents',
    });
    const created = prisma.groupCircular.create.mock.calls[0][0].data;
    expect(created.branches.create).toEqual([{ tenantId: 'b1' }]);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(notifications.send).toHaveBeenCalledTimes(2);
    expect(notifications.broadcast).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ targetType: 'all_parents', kind: 'notice' }),
      HO,
    );
  });

  it('refuses a circular to a school outside the group, or with no school to receive it', async () => {
    const { service } = setup();
    await expect(
      service.createCircular(HO, {
        title: 'x',
        body: 'y',
        audience: 'staff',
        tenantIds: ['x'],
      }),
    ).rejects.toMatchObject({ response: { code: 'BRANCH_NOT_IN_GROUP' } });
    await expect(
      service.createCircular(HO, {
        title: 'x',
        body: 'y',
        audience: 'staff',
        tenantIds: ['b2'],
      }),
    ).rejects.toMatchObject({ response: { code: 'NO_BRANCHES' } });
  });
});
