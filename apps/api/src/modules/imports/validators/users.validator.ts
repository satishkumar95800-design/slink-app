import { ParsedTab, TabValidation, ValidUserRow } from '../types';
import { EMAIL_REGEX, PHONE_REGEX, issue, normalizedName } from './shared';
import { ALLOWED_ROLES } from '../tab-schema';

const TAB = 'Users' as const;
const ALLOWED_ROLES_SET: Set<string> = new Set(ALLOWED_ROLES);

export function validateUsersTab(
  tab: ParsedTab,
  classNames: Set<string>,
): TabValidation<ValidUserRow> {
  const errors: TabValidation<ValidUserRow>['errors'] = [];
  const warnings: TabValidation<ValidUserRow>['warnings'] = [];
  const validRows: ValidUserRow[] = [];
  const seenEmails = new Set<string>();

  for (const row of tab.rows) {
    const name = row.cells['Full Name'];
    const email = row.cells['Email'];
    const phone = row.cells['Phone Number'];
    const roleRaw = row.cells['Role'];
    const assignedClass = row.cells['Assigned Class (Teachers only)'];

    let hasError = false;

    if (!name) {
      errors.push(issue(TAB, row.rowNumber, 'Full Name', 'is required'));
      hasError = true;
    }
    if (!email) {
      errors.push(issue(TAB, row.rowNumber, 'Email', 'is required'));
      hasError = true;
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push(
        issue(TAB, row.rowNumber, 'Email', 'is not a valid email address'),
      );
      hasError = true;
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Phone Number',
          'must be in E.164 format, e.g. +919876543210',
        ),
      );
      hasError = true;
    }

    const role = roleRaw.trim().toLowerCase();
    if (!roleRaw) {
      errors.push(issue(TAB, row.rowNumber, 'Role', 'is required'));
      hasError = true;
    } else if (!ALLOWED_ROLES_SET.has(role)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Role',
          'must be one of: admin, accounts, teacher',
        ),
      );
      hasError = true;
    }

    if (assignedClass && !classNames.has(normalizedName(assignedClass))) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Assigned Class (Teachers only)',
          `references a class ("${assignedClass}") not found in the Classes tab`,
        ),
      );
      hasError = true;
    }

    if (hasError) continue;

    const emailKey = email.trim().toLowerCase();
    if (seenEmails.has(emailKey)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Email',
          `duplicate email "${email}" already defined earlier in this file`,
        ),
      );
      continue;
    }
    seenEmails.add(emailKey);

    validRows.push({
      row: row.rowNumber,
      name,
      email,
      phone: phone || undefined,
      role: role as ValidUserRow['role'],
      assignedClassName: assignedClass || undefined,
    });
  }

  return { errors, warnings, validRows };
}
