import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PettyCashController } from './petty-cash.controller';
import { PettyCashFeatureGuard } from './petty-cash-feature.guard';

const proto = PettyCashController.prototype as unknown as Record<
  string,
  unknown
>;
const handlers = Object.getOwnPropertyNames(proto).filter(
  (k) => k !== 'constructor' && typeof proto[k] === 'function',
);

function ctx(
  handlerName: string,
  role: Role | undefined,
  tenantId = 't1',
): ExecutionContext {
  return {
    getHandler: () => proto[handlerName],
    getClass: () => PettyCashController,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined, tenantId }),
    }),
  } as unknown as ExecutionContext;
}

describe('PettyCashController access', () => {
  const rolesGuard = new RolesGuard(new Reflector());
  const allowed = (h: string, role: Role) =>
    rolesGuard.canActivate(ctx(h, role));

  it('exposes every route (sanity)', () => {
    expect(handlers.length).toBeGreaterThanOrEqual(20);
  });

  it.each(handlers)(
    '%s: parents, teachers and anonymous callers are refused',
    (h) => {
      expect(allowed(h, Role.parent)).toBe(false);
      expect(allowed(h, Role.teacher)).toBe(false);
      expect(allowed(h, Role.developer)).toBe(false);
      expect(rolesGuard.canActivate(ctx(h, undefined))).toBe(false);
    },
  );

  it.each(handlers)('%s: admin is allowed', (h) => {
    expect(allowed(h, Role.admin)).toBe(true);
  });

  it.each(handlers)('%s: is behind the feature guard', (h) => {
    // Class-level @UseGuards applies to every handler.
    const guards = Reflect.getMetadata(
      '__guards__',
      PettyCashController,
    ) as unknown[];
    expect(guards).toContain(PettyCashFeatureGuard);
    expect(handlers).toContain(h);
  });

  it('only admins approve, reject and change settings; accounts can do the rest', () => {
    for (const h of ['approve', 'reject', 'updateSettings']) {
      expect(allowed(h, Role.admin)).toBe(true);
      expect(allowed(h, Role.accounts)).toBe(false);
    }
    for (const h of handlers.filter(
      (x) => !['approve', 'reject', 'updateSettings'].includes(x),
    ))
      expect(allowed(h, Role.accounts)).toBe(true);
  });
});

describe('PettyCashFeatureGuard', () => {
  const guardFor = (features: unknown) =>
    new PettyCashFeatureGuard({
      tenant: { findUnique: jest.fn().mockResolvedValue({ features }) },
    } as never);

  it('lets the request through when pettyCash is on', async () => {
    await expect(
      guardFor({ pettyCash: true }).canActivate(ctx('summary', Role.admin)),
    ).resolves.toBe(true);
  });

  it.each([{}, { pettyCash: false }, { aiInsights: true }, null])(
    'answers FEATURE_DISABLED for %j',
    async (features) => {
      await expect(
        guardFor(features).canActivate(ctx('summary', Role.admin)),
      ).rejects.toMatchObject({
        response: { code: 'FEATURE_DISABLED' },
      });
      await expect(
        guardFor(features).canActivate(ctx('summary', Role.admin)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('checks the tenant of the request, not a body value', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValue({ features: { pettyCash: true } });
    await new PettyCashFeatureGuard({
      tenant: { findUnique },
    } as never).canActivate(ctx('summary', Role.admin, 'tenant-x'));
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tenant-x' } }),
    );
  });
});
