import { ParsedTab, TabValidation, ValidClassRow, ValidTeacherRow } from '../types';
import { EMAIL_REGEX, PHONE_REGEX, issue, resolveClass } from './shared';

const TAB = 'Teachers' as const;

function parseIsClassTeacher(raw: string): boolean {
  return raw.trim().toLowerCase() === 'yes';
}

export function validateTeachersTab(
  tab: ParsedTab,
  classes: ValidClassRow[],
): TabValidation<ValidTeacherRow> {
  const errors: TabValidation<ValidTeacherRow>['errors'] = [];
  const warnings: TabValidation<ValidTeacherRow>['warnings'] = [];
  const validRows: ValidTeacherRow[] = [];
  const seenAssignments = new Set<string>();

  for (const row of tab.rows) {
    const name = row.cells['Teacher Name'];
    const phone = row.cells['Phone Number'];
    const email = row.cells['Email'];
    const className = row.cells['Class Name'];
    const section = row.cells['Section'];
    const subjectName = row.cells['Subject Name'];
    const isClassTeacherRaw = row.cells['Is Class Teacher'];

    let hasError = false;

    if (!name) {
      errors.push(issue(TAB, row.rowNumber, 'Teacher Name', 'is required'));
      hasError = true;
    }
    if (!phone) {
      errors.push(issue(TAB, row.rowNumber, 'Phone Number', 'is required'));
      hasError = true;
    } else if (!PHONE_REGEX.test(phone)) {
      errors.push(
        issue(TAB, row.rowNumber, 'Phone Number', 'must be in E.164 format, e.g. +919876543210'),
      );
      hasError = true;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      errors.push(issue(TAB, row.rowNumber, 'Email', 'is not a valid email address'));
      hasError = true;
    }
    if (!subjectName) {
      errors.push(issue(TAB, row.rowNumber, 'Subject Name', 'is required'));
      hasError = true;
    }
    if (!className) {
      errors.push(issue(TAB, row.rowNumber, 'Class Name', 'is required'));
      hasError = true;
    }

    let classKey: string | undefined;
    if (className) {
      const resolution = resolveClass(classes, className, section);
      if (resolution.status === 'not_found') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            `class "${className}"${section ? ` (Section ${section})` : ''} not found in the Classes tab`,
          ),
        );
        hasError = true;
      } else if (resolution.status === 'ambiguous') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            `"${className}"${section ? ` (Section ${section})` : ''} matches ${resolution.count} classes — add a Section to disambiguate`,
          ),
        );
        hasError = true;
      } else {
        classKey = resolution.key;
      }
    }

    if (hasError || !classKey) continue;

    const dedupeKey = `${phone.trim()}|${classKey}|${subjectName.trim().toLowerCase()}`;
    if (seenAssignments.has(dedupeKey)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Subject Name',
          `duplicate assignment — this teacher/class/subject combination already appears earlier in this file`,
        ),
      );
      continue;
    }
    seenAssignments.add(dedupeKey);

    validRows.push({
      row: row.rowNumber,
      name,
      phone,
      email: email || undefined,
      classKey,
      subjectName,
      isClassTeacher: parseIsClassTeacher(isClassTeacherRaw ?? ''),
    });
  }

  return { errors, warnings, validRows };
}
