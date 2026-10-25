import { HttpException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hashCode, MAX_TRIES } from './login-code';
import { LoginCodesService } from './login-codes.service';

const SECRET = 'test-secret';

interface Row {
  id: string;
  codeHash: string;
  attempts: number;
  sends: number;
  lastSentAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  deviceId: string | null;
}
type Where = {
  id: string;
  usedAt?: null;
  expiresAt?: { gt: Date };
  attempts?: { lt: number };
};
type Data = Partial<Omit<Row, 'attempts' | 'sends'>> & {
  attempts?: { increment: number };
  sends?: { increment: number };
};

function setup(
  opts: { mail?: boolean; sent?: boolean; production?: boolean } = {},
) {
  const rows = new Map<string, Row>();
  const apply = (row: Row, data: Data) => {
    const { attempts, sends, ...rest } = data;
    Object.assign(row, rest);
    if (attempts) row.attempts += attempts.increment;
    if (sends) row.sends += sends.increment;
  };
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ loginCodes: false }),
      update: jest.fn(),
    },
    user: { count: jest.fn().mockResolvedValue(4) },
    loginChallenge: {
      deleteMany: jest.fn(),
      aggregate: jest.fn(() => ({
        _sum: {
          attempts: [...rows.values()]
            .filter((r) => r.usedAt === null)
            .reduce((n, r) => n + r.attempts, 0),
        },
      })),
      create: jest.fn(
        ({
          data,
        }: {
          data: Pick<Row, 'codeHash' | 'expiresAt' | 'deviceId'>;
        }) => {
          const row: Row = {
            id: `c${rows.size + 1}`,
            attempts: 0,
            sends: 1,
            lastSentAt: new Date(),
            usedAt: null,
            ...data,
          };
          rows.set(row.id, row);
          return { id: row.id };
        },
      ),
      update: jest.fn(({ where, data }: { where: Where; data: Data }) => {
        const row = rows.get(where.id)!;
        apply(row, data);
        return row;
      }),
      delete: jest.fn(({ where }: { where: Where }) => rows.delete(where.id)),
      updateMany: jest.fn(({ where, data }: { where: Where; data: Data }) => {
        const row = rows.get(where.id);
        const ok =
          !!row &&
          (where.usedAt !== null || row.usedAt === null) &&
          (!where.expiresAt || row.expiresAt > where.expiresAt.gt) &&
          (!where.attempts || row.attempts < where.attempts.lt);
        if (!ok) return { count: 0 };
        apply(row, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(({ where }: { where: Where }) => ({
        ...rows.get(where.id)!,
        user: { id: 'u1' },
      })),
      findUnique: jest.fn(({ where }: { where: Where }) => {
        const row = rows.get(where.id);
        return row
          ? { ...row, user: { id: 'u1', email: 'admin@school.in' } }
          : null;
      }),
    },
  };
  const mailer = {
    enabled: opts.mail ?? true,
    send: jest.fn().mockResolvedValue(opts.sent ?? true),
  };
  const config = {
    getOrThrow: () => SECRET,
    get: (k: string) =>
      k === 'NODE_ENV' && opts.production ? 'production' : undefined,
  };
  const service = new LoginCodesService(
    prisma as never,
    mailer as never,
    config as never,
  );
  /** The code that was emailed last. */
  const lastCode = () =>
    String((mailer.send.mock.calls.at(-1) as unknown[])[2]).match(/\d{6}/)![0];
  return { service, prisma, mailer, rows, lastCode };
}

const user = { id: 'u1', email: 'admin@school.in' };

describe('LoginCodesService', () => {
  it('emails a code and stores only its hash', async () => {
    const { service, mailer, rows, lastCode } = setup();
    const res = await service.start(user, 'en');
    expect(res).toEqual({
      codeRequired: true,
      challengeId: 'c1',
      sentTo: 'ad•••@school.in',
    });
    expect(mailer.send).toHaveBeenCalledWith(
      'admin@school.in',
      expect.stringContaining(lastCode()),
      expect.any(String),
    );
    expect(rows.get('c1')!.codeHash).toBe(hashCode(SECRET, 'c1', lastCode()));
    expect(JSON.stringify(rows.get('c1'))).not.toContain(lastCode());
  });

  it('signs in with the right code, once', async () => {
    const { service, lastCode } = setup();
    await service.start(user, 'en');
    const code = lastCode();
    await expect(service.verify('c1', code)).resolves.toMatchObject({
      user: { id: 'u1' },
    });
    await expect(service.verify('c1', code)).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_EXPIRED' },
    });
  });

  it(`refuses wrong codes and stops after ${MAX_TRIES} tries, even with the right one`, async () => {
    const { service, lastCode } = setup();
    await service.start(user, 'en');
    const right = lastCode();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 1; i < MAX_TRIES; i++)
      await expect(service.verify('c1', wrong)).rejects.toMatchObject({
        response: { code: 'LOGIN_CODE_WRONG', triesLeft: MAX_TRIES - i },
      });
    await expect(service.verify('c1', wrong)).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_EXPIRED' },
    });
    await expect(service.verify('c1', right)).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_EXPIRED' },
    });
  });

  it('locks codes for the day after 15 wrong ones, across sign-ins', async () => {
    const { service } = setup();
    for (let n = 0; n < 3; n++) {
      const { challengeId } = await service.start(user, 'en');
      for (let i = 0; i < MAX_TRIES; i++)
        await service.verify(challengeId, 'x').catch(() => undefined);
    }
    await expect(service.start(user, 'en')).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_LOCKED' },
    });
  });

  it('refuses an expired code', async () => {
    const { service, rows, lastCode } = setup();
    await service.start(user, 'en');
    rows.get('c1')!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.verify('c1', lastCode())).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_EXPIRED' },
    });
  });

  it('resends a new code after the wait, and the old one stops working', async () => {
    const { service, rows, lastCode } = setup();
    await service.start(user, 'en');
    const first = lastCode();
    await expect(
      service.resend('c1', () => Promise.resolve('en' as const)),
    ).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_WAIT' },
    });
    rows.get('c1')!.lastSentAt = new Date(Date.now() - 60_000);
    await service.resend('c1', () => Promise.resolve('en' as const));
    const second = lastCode();
    if (first !== second)
      await expect(service.verify('c1', first)).rejects.toMatchObject({
        response: { code: 'LOGIN_CODE_WRONG' },
      });
    await expect(service.verify('c1', second)).resolves.toBeDefined();
  });

  it('stops resending after three emails', async () => {
    const { service, rows } = setup();
    await service.start(user, 'en');
    rows.get('c1')!.sends = 3;
    rows.get('c1')!.lastSentAt = new Date(0);
    await expect(
      service.resend('c1', () => Promise.resolve('en' as const)),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('when the email fails, says so and leaves no challenge behind', async () => {
    const { service, rows } = setup({ sent: false });
    await expect(service.start(user, 'en')).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_NOT_SENT' },
    });
    expect(rows.size).toBe(0);
  });

  it('on a production server without email, refuses rather than skipping the code', async () => {
    const { service } = setup({ mail: false, production: true });
    await expect(service.start(user, 'en')).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_NOT_SENT' },
    });
  });

  it('will not let a school switch codes on when email is not set up', async () => {
    const { service, prisma } = setup({ mail: false, production: true });
    await expect(service.setEnabled('t1', true)).rejects.toMatchObject({
      response: { code: 'LOGIN_CODE_MAIL_OFF' },
    });
    expect(prisma.tenant.update).not.toHaveBeenCalled();
    await service.setEnabled('t1', false);
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it('isRequired follows the platform role and the school switch', async () => {
    const { service, prisma } = setup();
    prisma.tenant.findUnique.mockResolvedValue({
      features: { loginCodes: true },
      loginCodes: false,
    });
    expect(await service.isRequired({ role: Role.admin, tenantId: 't1' })).toBe(
      false,
    );
    expect(
      await service.isRequired({ role: Role.super_admin, tenantId: 't0' }),
    ).toBe(true);
  });
});
