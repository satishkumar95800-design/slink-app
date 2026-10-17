import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

const ctx = (role: Role | undefined) =>
  ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  }) as unknown as ExecutionContext;

const guard = (roles: Role[] | undefined) =>
  new RolesGuard({ getAllAndOverride: () => roles } as unknown as Reflector);

describe('RolesGuard', () => {
  it('keeps open routes open for school users and anonymous requests', () => {
    expect(guard(undefined).canActivate(ctx(Role.parent))).toBe(true);
    expect(guard(undefined).canActivate(ctx(undefined))).toBe(true);
  });

  it('checks listed roles as before', () => {
    expect(guard([Role.admin]).canActivate(ctx(Role.admin))).toBe(true);
    expect(guard([Role.admin]).canActivate(ctx(Role.teacher))).toBe(false);
  });

  it('lets a head office login reach only routes that name it', () => {
    expect(guard(undefined).canActivate(ctx(Role.head_office))).toBe(false);
    expect(guard([]).canActivate(ctx(Role.head_office))).toBe(false);
    expect(
      guard([Role.admin, Role.super_admin]).canActivate(ctx(Role.head_office)),
    ).toBe(false);
    expect(guard([Role.head_office]).canActivate(ctx(Role.head_office))).toBe(
      true,
    );
  });
});
