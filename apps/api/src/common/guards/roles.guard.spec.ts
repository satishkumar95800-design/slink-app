import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY, SELF_SERVICE_KEY } from '../decorators/roles.decorator';
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

  describe('drivers, librarians and receptionists', () => {
    const keyed = (roles: Role[] | undefined, selfService = false) =>
      new RolesGuard({
        getAllAndOverride: (key: string) =>
          key === ROLES_KEY
            ? roles
            : key === SELF_SERVICE_KEY
              ? selfService
              : undefined,
      } as unknown as Reflector);
    const narrow = [Role.driver, Role.librarian, Role.receptionist];

    it.each(narrow)('%s never reaches an open route', (role) => {
      expect(keyed(undefined).canActivate(ctx(role))).toBe(false);
      expect(keyed([Role.admin]).canActivate(ctx(role))).toBe(false);
    });

    it.each(narrow)(
      '%s reaches routes naming it and its own account',
      (role) => {
        expect(keyed([role, Role.admin]).canActivate(ctx(role))).toBe(true);
        expect(keyed(undefined, true).canActivate(ctx(role))).toBe(true);
      },
    );

    it('keeps head office off the self-service routes', () => {
      expect(keyed(undefined, true).canActivate(ctx(Role.head_office))).toBe(
        false,
      );
    });

    it('leaves self-service routes open to everyone else', () => {
      expect(keyed(undefined, true).canActivate(ctx(Role.parent))).toBe(true);
    });
  });
});
