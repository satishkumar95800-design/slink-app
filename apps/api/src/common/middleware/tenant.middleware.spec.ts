import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TenantMiddleware } from './tenant.middleware';

const SECRET = 'test-secret';
const TENANT = '00000000-0000-4000-8000-000000000001';

function setup(endsOn: string) {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: TENANT,
        timezone: 'Asia/Kolkata',
        subscriptionEndsOn: new Date(`${endsOn}T00:00:00Z`),
      }),
    },
  };
  const config = { getOrThrow: () => SECRET } as unknown as ConfigService;
  const mw = new TenantMiddleware(prisma as never, config);
  const run = async (token?: string) => {
    const req = {
      headers: {
        'x-tenant-id': TENANT,
        ...(token && { authorization: `Bearer ${token}` }),
      },
      hostname: 'api.schoolinkd.in',
    } as never as Parameters<TenantMiddleware['use']>[0];
    const next = jest.fn();
    await mw.use(req, {} as never, next);
    return { req, next };
  };
  return { run };
}

const token = (role: string, secret = SECRET) =>
  new JwtService({ secret }).sign({ sub: 'u1', tenantId: 'x', role });

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2027-10-30T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('TenantMiddleware subscription check', () => {
  it('lets a school in grace through', async () => {
    const { run } = setup('2027-10-25'); // 5 days over
    const { next, req } = await run();
    expect(next).toHaveBeenCalled();
    expect(req.tenantId).toBe(TENANT);
  });

  it('switches off a school past the grace period', async () => {
    const { run } = setup('2027-10-20'); // 10 days over
    await expect(run(token('admin'))).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_EXPIRED' },
    });
  });

  it('still lets the platform team in, but only with a genuine super_admin token', async () => {
    const { run } = setup('2027-10-20');
    expect((await run(token('super_admin'))).next).toHaveBeenCalled();
    await expect(run(token('super_admin', 'forged'))).rejects.toMatchObject({
      response: { code: 'SUBSCRIPTION_EXPIRED' },
    });
  });
});
