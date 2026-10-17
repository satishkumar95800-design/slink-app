/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- in-memory Prisma fake */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { SubscriptionsService } from './subscriptions.service';

const ID = 't1';
const ROOT: ActiveUser = {
  id: 'sa',
  role: Role.super_admin,
  tenantId: 'p',
  name: 'Root',
  isVerified: true,
};
const d = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

type Row = Record<string, any>;

function setup(
  endsOn: string,
  plan = 'premium',
  features: Row = { timetable: true, hrms: true },
) {
  const tenant: Row = {
    id: ID,
    slug: 's',
    name: 'School',
    timezone: 'Asia/Kolkata',
    isActive: true,
    features,
    subscriptionPlan: plan,
    subscriptionStartsOn: d('2026-10-17'),
    subscriptionEndsOn: d(endsOn),
    _count: { users: 3, students: 500 },
  };
  const renewals: Row[] = [];
  const audit: Row[] = [];
  const prisma: Row = {
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    tenant: {
      findUnique: jest.fn(() => Promise.resolve({ ...tenant })),
      findMany: jest.fn(() => Promise.resolve([{ ...tenant }])),
      update: jest.fn(({ data }: Row) => {
        Object.assign(tenant, data);
        return Promise.resolve({ ...tenant });
      }),
    },
    subscriptionRenewal: {
      create: jest.fn(({ data }: Row) => {
        const r = {
          id: `r${renewals.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        renewals.push(r);
        return Promise.resolve(r);
      }),
    },
    auditLog: {
      create: jest.fn(
        ({ data }: Row) => (audit.push(data), Promise.resolve(data)),
      ),
    },
  };
  return {
    service: new SubscriptionsService(prisma as never),
    tenant,
    renewals,
    audit,
  };
}

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2027-10-10T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('SubscriptionsService', () => {
  it('renews from the day after the current end and records the history', async () => {
    const { service, renewals, audit } = setup('2027-10-16');
    const t = await service.renew(
      ID,
      { amount: 29999, reference: 'UTR123' },
      ROOT,
    );
    expect(t.subscription).toMatchObject({
      startsOn: '2027-10-17',
      endsOn: '2028-10-16',
      status: 'active',
    });
    expect(renewals[0]).toMatchObject({
      plan: 'premium',
      amount: 29999,
      reference: 'UTR123',
    });
    expect(audit[0].action).toBe('subscription.renew');
  });

  it('renews a school switched off long ago from today', async () => {
    const { service } = setup('2027-08-01');
    const t = await service.renew(ID, {}, ROOT);
    expect(t.subscription).toMatchObject({
      startsOn: '2027-10-10',
      endsOn: '2028-10-09',
    });
  });

  it('applies the new plan preset on an upgrade at renewal, keeping other flags', async () => {
    const { service, tenant } = setup('2027-10-16', 'premium', {
      transportFeeModule: true,
      timetable: true,
    });
    await service.renew(ID, { plan: 'premium_max' }, ROOT);
    expect(tenant.subscriptionPlan).toBe('premium_max');
    expect(tenant.features).toMatchObject({
      transportFeeModule: true,
      hrms: true,
      aiInsights: true,
      syllabus: true,
    });
  });

  it('refuses an end date before the start', async () => {
    const { service } = setup('2027-10-16');
    await expect(
      service.update(
        ID,
        { startsOn: '2027-10-01', endsOn: '2027-09-01' },
        ROOT,
      ),
    ).rejects.toMatchObject({
      response: { code: 'PERIOD_INVALID' },
    });
  });

  it('lists only schools that need attention', async () => {
    const { service } = setup('2027-10-16'); // 6 days left
    const list = await service.renewals();
    expect(list).toHaveLength(1);
    expect(list[0].subscription.status).toBe('renewal_due');
    expect(list[0].subscription.yearlyAmount.total).toBe(29999 + 18000);
  });
});
