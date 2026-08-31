import { ParsedTab, TabValidation, ValidClassRow } from '../types';
import { ACADEMIC_YEAR_REGEX, EMAIL_REGEX, classKey, issue } from './shared';

const TAB = 'Classes' as const;

export function validateClassesTab(
  tab: ParsedTab,
): TabValidation<ValidClassRow> {
  const errors: TabValidation<ValidClassRow>['errors'] = [];
  const warnings: TabValidation<ValidClassRow>['warnings'] = [];
  const validRows: ValidClassRow[] = [];
  const seenKeys = new Set<string>();

  for (const row of tab.rows) {
    const name = row.cells['Class Name'];
    const section = row.cells['Section'];
    const academicYear = row.cells['Academic Year'];
    const classTeacherEmail = row.cells['Class Teacher Email'];

    let hasError = false;

    if (!name) {
      errors.push(issue(TAB, row.rowNumber, 'Class Name', 'is required'));
      hasError = true;
    }
    if (!section) {
      errors.push(issue(TAB, row.rowNumber, 'Section', 'is required'));
      hasError = true;
    }
    if (!academicYear) {
      errors.push(issue(TAB, row.rowNumber, 'Academic Year', 'is required'));
      hasError = true;
    } else if (!ACADEMIC_YEAR_REGEX.test(academicYear)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Academic Year',
          'must be in format YYYY-YY, e.g. 2025-26',
        ),
      );
      hasError = true;
    }
    if (classTeacherEmail && !EMAIL_REGEX.test(classTeacherEmail)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Class Teacher Email',
          'is not a valid email address',
        ),
      );
      hasError = true;
    }

    if (hasError) continue;

    const key = classKey(name, section, academicYear);
    if (seenKeys.has(key)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          undefined,
          `Duplicate class "${name}" (Section ${section}, ${academicYear}) already defined earlier in this file`,
        ),
      );
      continue;
    }
    seenKeys.add(key);

    validRows.push({
      row: row.rowNumber,
      name,
      section,
      academicYear,
      classTeacherEmail: classTeacherEmail || undefined,
    });
  }

  return { errors, warnings, validRows };
}
