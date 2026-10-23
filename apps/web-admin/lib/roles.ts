/**
 * Console logins kept to their own pages (the API refuses them everywhere
 * else): the sidebar shows them only items that name them in `onlyRoles`.
 */
export const DESK_ROLES = ['receptionist', 'librarian'] as const;

export const isDeskRole = (role: string | undefined): boolean =>
  !!role && (DESK_ROLES as readonly string[]).includes(role);

/** Where a login lands after sign-in (and instead of the admin dashboard). */
export function homeFor(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/platform/dashboard';
    case 'head_office':
      return '/head-office';
    case 'receptionist':
      return '/admin/reception';
    case 'librarian':
      return '/admin/library';
    default:
      return '/admin';
  }
}
