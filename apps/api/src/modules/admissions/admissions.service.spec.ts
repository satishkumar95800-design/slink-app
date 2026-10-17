/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- in-memory Prisma fake */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { AdmissionsService } from './admissions.service';

const ADMIN: ActiveUser = {
  id: 'a1',
  role: Role.admin,
  tenantId: 't1',
  name: 'Admin',
  isVerified: true,
};
type Row = Record<string, any>;

function setup() {
  const enquiries: Row[] = [];
  const activities: Row[] = [];
  const prisma: Row = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Admin' }]),
      findFirst: jest.fn(),
    },
    admissionEnquiry: {
      create: jest.fn(({ data }: Row) => {
        const r = {
          id: `e${enquiries.length + 1}`,
          stage: 'enquiry',
          stageChangedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          dob: null,
          tourOn: null,
          lostReason: null,
          ...data,
        };
        enquiries.push(r);
        return Promise.resolve(r);
      }),
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          enquiries.find(
            (e) => e.id === where.id && e.tenantId === where.tenantId,
          ) ?? null,
        ),
      ),
      update: jest.fn(({ where, data }: Row) => {
        const r = enquiries.find((e) => e.id === where.id)!;
        Object.assign(r, data);
        return Promise.resolve(r);
      }),
    },
    admissionActivity: {
      create: jest.fn(
        ({ data }: Row) => (activities.push(data), Promise.resolve(data)),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(
          activities.map((a, i) => ({
            id: `act${i}`,
            createdAt: new Date(),
            ...a,
          })),
        ),
      ),
    },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return {
    service: new AdmissionsService(prisma as never),
    enquiries,
    activities,
  };
}

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2026-10-17T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('AdmissionsService', () => {
  const base = {
    childName: 'Aarav',
    parentName: 'Ritu',
    phone: '9876543210',
    source: 'walk_in' as const,
  };

  it('records the enquiry and a created activity', async () => {
    const { service, activities } = setup();
    const e = await service.create(
      't1',
      { ...base, nextFollowUpOn: '2026-10-17' },
      ADMIN,
    );
    expect(e).toMatchObject({ stage: 'enquiry', followUpDue: true });
    expect(activities[0]).toMatchObject({
      kind: 'created',
      toStage: 'enquiry',
    });
  });

  it('needs a reason to mark an enquiry lost, and closes its follow-up', async () => {
    const { service, enquiries } = setup();
    const e = await service.create(
      't1',
      { ...base, nextFollowUpOn: '2026-10-20' },
      ADMIN,
    );
    await expect(
      service.moveStage('t1', e.id, { stage: 'lost' }, ADMIN),
    ).rejects.toMatchObject({
      response: { code: 'LOST_REASON_REQUIRED' },
    });
    const lost = await service.moveStage(
      't1',
      e.id,
      { stage: 'lost', lostReason: 'Chose another school' },
      ADMIN,
    );
    expect(lost).toMatchObject({
      stage: 'lost',
      lostReason: 'Chose another school',
      nextFollowUpOn: null,
    });
    expect(enquiries[0].nextFollowUpOn).toBeNull();
  });

  it("refuses another school's enquiry and an unchanged stage", async () => {
    const { service } = setup();
    const e = await service.create('t1', base, ADMIN);
    await expect(service.detail('t2', e.id)).rejects.toMatchObject({
      response: { code: 'ENQUIRY_NOT_FOUND' },
    });
    await expect(
      service.moveStage('t1', e.id, { stage: 'enquiry' }, ADMIN),
    ).rejects.toMatchObject({
      response: { code: 'STAGE_UNCHANGED' },
    });
  });
});
