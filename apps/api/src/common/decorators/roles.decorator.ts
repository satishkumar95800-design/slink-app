import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Logins limited to their own screens. They reach only routes that name them
 * in @Roles (or, except head office, routes marked @SelfService), never a
 * school's open routes, so a route added without @Roles never leaks to them.
 */
export const NARROW_ROLES: Role[] = [
  Role.head_office,
  Role.driver,
  Role.librarian,
  Role.receptionist,
];

export const SELF_SERVICE_KEY = 'selfService';
/** The signed-in user's own account (profile, language, password, sign-out): open to every school login. */
export const SelfService = () => SetMetadata(SELF_SERVICE_KEY, true);
