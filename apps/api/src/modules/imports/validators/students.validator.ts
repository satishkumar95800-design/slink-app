import {
  ParsedTab,
  TabValidation,
  ValidClassRow,
  ValidStudentRow,
} from '../types';
import {
  EMAIL_REGEX,
  PHONE_REGEX,
  isValidCalendarDate,
  issue,
  resolveClass,
} from './shared';

const TAB = 'Students' as const;

export function validateStudentsTab(
  tab: ParsedTab,
  classes: ValidClassRow[],
): TabValidation<ValidStudentRow> {
  const errors: TabValidation<ValidStudentRow>['errors'] = [];
  const warnings: TabValidation<ValidStudentRow>['warnings'] = [];
  const validRows: ValidStudentRow[] = [];
  const seenAdmissionNos = new Set<string>();
  const parentPhoneRows = new Map<string, number[]>();

  for (const row of tab.rows) {
    const name = row.cells['Student Name'];
    const admissionNo = row.cells['Admission Number'];
    const className = row.cells['Class Name'];
    const section = row.cells['Section'];
    const dob = row.cells['Date of Birth'];
    const parentName = row.cells['Parent Name'];
    const parentPhone = row.cells['Parent Mobile Number'];
    const parentEmail = row.cells['Parent Email'];

    let hasError = false;

    if (!name) {
      errors.push(issue(TAB, row.rowNumber, 'Student Name', 'is required'));
      hasError = true;
    }
    if (!admissionNo) {
      errors.push(issue(TAB, row.rowNumber, 'Admission Number', 'is required'));
      hasError = true;
    }
    if (!className) {
      errors.push(issue(TAB, row.rowNumber, 'Class Name', 'is required'));
      hasError = true;
    }
    if (!section) {
      errors.push(issue(TAB, row.rowNumber, 'Section', 'is required'));
      hasError = true;
    }
    if (dob && !isValidCalendarDate(dob)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Date of Birth',
          'must be in format YYYY-MM-DD',
        ),
      );
      hasError = true;
    }
    if (!parentName) {
      errors.push(issue(TAB, row.rowNumber, 'Parent Name', 'is required'));
      hasError = true;
    }
    if (!parentPhone) {
      errors.push(
        issue(TAB, row.rowNumber, 'Parent Mobile Number', 'is required'),
      );
      hasError = true;
    } else if (!PHONE_REGEX.test(parentPhone)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Parent Mobile Number',
          'must be in E.164 format, e.g. +919876543210',
        ),
      );
      hasError = true;
    }
    if (parentEmail && !EMAIL_REGEX.test(parentEmail)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Parent Email',
          'is not a valid email address',
        ),
      );
      hasError = true;
    }

    let classKey: string | undefined;
    if (className && section) {
      const resolution = resolveClass(classes, className, section);
      if (resolution.status === 'not_found') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            `class "${className}" (Section ${section}) not found in the Classes tab`,
          ),
        );
        hasError = true;
      } else if (resolution.status === 'ambiguous') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            `"${className}" (Section ${section}) matches ${resolution.count} classes across different academic years — cannot resolve`,
          ),
        );
        hasError = true;
      } else {
        classKey = resolution.key;
      }
    }

    if (hasError || !classKey) continue;

    if (seenAdmissionNos.has(admissionNo.trim().toLowerCase())) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Admission Number',
          `duplicate admission number "${admissionNo}" already used earlier in this file`,
        ),
      );
      continue;
    }
    seenAdmissionNos.add(admissionNo.trim().toLowerCase());

    if (parentPhone) {
      const rows = parentPhoneRows.get(parentPhone) ?? [];
      rows.push(row.rowNumber);
      parentPhoneRows.set(parentPhone, rows);
    }

    validRows.push({
      row: row.rowNumber,
      name,
      admissionNo,
      classKey,
      dob: dob || undefined,
      parentName,
      parentPhone,
      parentEmail: parentEmail || undefined,
    });
  }

  for (const [phone, rows] of parentPhoneRows) {
    if (rows.length > 1) {
      for (const rowNumber of rows) {
        warnings.push(
          issue(
            TAB,
            rowNumber,
            'Parent Mobile Number',
            `"${phone}" is linked to ${rows.length} students in this file — confirm this is intentional (e.g. siblings)`,
          ),
        );
      }
    }
  }

  return { errors, warnings, validRows };
}
