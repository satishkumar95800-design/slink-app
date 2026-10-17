/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- in-memory Prisma fake */
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

function setup(userGroup: string | null = 'g1') {
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
        group: userGroup ? { id: userGroup, name: 'Vidya Group' } : null,
      }),
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
    attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]) },
    broadcast: { groupBy: jest.fn().mockResolvedValue([]) },
    class: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { service: new HeadOfficeService(prisma as never), prisma };
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
      branches: [],
    });
    await expect(service.branch(HO, 'b1')).rejects.toMatchObject({
      response: { code: 'BRANCH_NOT_IN_GROUP' },
    });
  });
});
