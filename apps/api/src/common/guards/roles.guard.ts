import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import {
  NARROW_ROLES,
  ROLES_KEY,
  SELF_SERVICE_KEY,
} from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role?: Role } }>();

    // A head office login is read-only and cross-school: it may only reach
    // routes that name it explicitly, never a school's open routes
    // (docs/SPEC-subscriptions.md 6.2). Drivers, librarians and receptionists
    // are kept to their own screens the same way, plus their own account.
    if (user?.role && NARROW_ROLES.includes(user.role)) {
      if (requiredRoles?.includes(user.role)) return true;
      const selfService = this.reflector.getAllAndOverride<boolean>(
        SELF_SERVICE_KEY,
        [context.getHandler(), context.getClass()],
      );
      return (
        !!selfService &&
        !requiredRoles?.length &&
        user.role !== Role.head_office
      );
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return requiredRoles.includes(user?.role as Role);
  }
}
