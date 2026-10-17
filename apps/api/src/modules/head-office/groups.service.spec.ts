/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- in-memory Prisma fake */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { GroupsService } from './groups.service';

const ROOT: ActiveUser = {
  id: 'sa',
  role: Role.super_admin,
  tenantId: 'p',
  name: 'Root',
  isVerified: true,
};
type Row = Record<string, any>;

function setup(group: Row, others: Row[] = [], existingEmail = false) {
  const prisma: Row = {
    schoolGroup: {
      findUnique: jest.fn().mockResolvedValue(group),
      delete: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(({ where }: Row) =>
        Promise.resolve(others.filter((t) => where.id.in.includes(t.id))),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest
        .fn()
        .mockResolvedValue(existingEmail ? { id: 'u' } : null),
      create: jest.fn(({ data }: Row) =>
        Promise.resolve({
          id: 'new',
          name: data.name,
          email: data.email,
          createdAt: new Date(),
          _data: data,
        }),
      ),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  return { service: new GroupsService(prisma as never), prisma };
}

describe('GroupsService', () => {
  it('refuses a school that belongs to another group', async () => {
    const { service } = setup({ id: 'g1', name: 'G', tenants: [], users: [] }, [
      { id: 't1', name: 'Other School', groupId: 'g2' },
    ]);
    await expect(
      service.setSchools('g1', { tenantIds: ['t1'] }, ROOT),
    ).rejects.toMatchObject({
      response: { code: 'TENANT_IN_OTHER_GROUP', schools: ['Other School'] },
    });
  });

  it('creates a head office login on one of the group schools, with a hashed password', async () => {
    const { service, prisma } = setup({
      id: 'g1',
      name: 'G',
      tenants: [{ id: 't1', name: 'A', subscriptionPlan: 'premium' }],
      users: [],
    });
    await service.createUser(
      'g1',
      { name: 'Head', email: 'ho@x.in', password: 'secret123' },
      ROOT,
    );
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: 't1',
      groupId: 'g1',
      role: Role.head_office,
      email: 'ho@x.in',
    });
    expect(data.passwordHash).not.toBe('secret123');
  });

  it('needs a school first, and a free email', async () => {
    await expect(
      setup({ id: 'g1', tenants: [], users: [] }).service.createUser(
        'g1',
        { name: 'H', email: 'a@b.in', password: 'secret123' },
        ROOT,
      ),
    ).rejects.toMatchObject({ response: { code: 'GROUP_EMPTY' } });
    await expect(
      setup(
        { id: 'g1', tenants: [{ id: 't1' }], users: [] },
        [],
        true,
      ).service.createUser(
        'g1',
        { name: 'H', email: 'a@b.in', password: 'secret123' },
        ROOT,
      ),
    ).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });
  });

  it('only deletes an empty group', async () => {
    const { service } = setup({
      id: 'g1',
      name: 'G',
      tenants: [{ id: 't1' }],
      users: [],
    });
    await expect(service.remove('g1', ROOT)).rejects.toMatchObject({
      response: { code: 'GROUP_NOT_EMPTY' },
    });
  });
});
