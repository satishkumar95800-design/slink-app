import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

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
    // (docs/SPEC-subscriptions.md 6.2).
    if (user?.role === Role.head_office) {
      return !!requiredRoles?.includes(Role.head_office);
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return requiredRoles.includes(user?.role as Role);
  }
}
