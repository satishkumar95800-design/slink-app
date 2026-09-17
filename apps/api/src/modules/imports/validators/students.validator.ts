import { Caste, GuardianRelation } from '@prisma/client';
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
import {
  BLOOD_GROUP_TEMPLATE_OPTIONS,
  CASTE_TEMPLATE_OPTIONS,
  GUARDIAN_RELATION_TEMPLATE_OPTIONS,
} from '../tab-schema';
import { BLOOD_GROUP_DISPLAY_TO_ENUM } from '../../../common/blood-group';

const TAB = 'Students' as const;
const CASTE_SET = new Set<string>(CASTE_TEMPLATE_OPTIONS);
const GUARDIAN_RELATION_SET = new Set<string>(GUARDIAN_RELATION_TEMPLATE_OPTIONS);

/** "Father" -> GuardianRelation.father; falls back to "guardian" when the cell is blank. */
function parseGuardianRelation(raw: string): GuardianRelation {
  return (raw ? raw.toLowerCase() : 'guardian') as GuardianRelation;
}

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
    const parentRelationRaw = row.cells['Guardian 1 Relation'];
    const parentPhone = row.cells['Parent Mobile Number'];
    const parentEmail = row.cells['Parent Email'];
    const parentProfession = row.cells['Parent Profession'];
    const guardian2Name = row.cells['Guardian 2 Name'];
    const guardian2RelationRaw = row.cells['Guardian 2 Relation'];
    const guardian2Phone = row.cells['Guardian 2 Mobile Number'];
    const guardian2Email = row.cells['Guardian 2 Email'];
    const guardian2Profession = row.cells['Guardian 2 Profession'];
    const bloodGroupRaw = row.cells['Blood Group'];
    const casteRaw = row.cells['Caste'];

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
    if (parentRelationRaw && !GUARDIAN_RELATION_SET.has(parentRelationRaw)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Guardian 1 Relation',
          `must be one of ${GUARDIAN_RELATION_TEMPLATE_OPTIONS.join(', ')}`,
        ),
      );
      hasError = true;
    }
    if (guardian2Name) {
      if (!guardian2Phone) {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Guardian 2 Mobile Number',
            'is required when Guardian 2 Name is filled in',
          ),
        );
        hasError = true;
      } else if (!PHONE_REGEX.test(guardian2Phone)) {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Guardian 2 Mobile Number',
            'must be in E.164 format, e.g. +919876543210',
          ),
        );
        hasError = true;
      } else if (guardian2Phone === parentPhone) {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Guardian 2 Mobile Number',
            'must be different from Parent Mobile Number',
          ),
        );
        hasError = true;
      }
      if (guardian2Email && !EMAIL_REGEX.test(guardian2Email)) {
        errors.push(
          issue(TAB, row.rowNumber, 'Guardian 2 Email', 'is not a valid email address'),
        );
        hasError = true;
      }
      if (guardian2RelationRaw && !GUARDIAN_RELATION_SET.has(guardian2RelationRaw)) {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Guardian 2 Relation',
            `must be one of ${GUARDIAN_RELATION_TEMPLATE_OPTIONS.join(', ')}`,
          ),
        );
        hasError = true;
      }
    }
    if (bloodGroupRaw && !BLOOD_GROUP_DISPLAY_TO_ENUM[bloodGroupRaw]) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Blood Group',
          `must be one of ${BLOOD_GROUP_TEMPLATE_OPTIONS.join(', ')}`,
        ),
      );
      hasError = true;
    }
    if (casteRaw && !CASTE_SET.has(casteRaw)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Caste',
          `must be one of ${CASTE_TEMPLATE_OPTIONS.join(', ')}`,
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
      bloodGroup: bloodGroupRaw ? BLOOD_GROUP_DISPLAY_TO_ENUM[bloodGroupRaw] : undefined,
      caste: casteRaw ? (casteRaw as Caste) : undefined,
      parentName,
      parentRelation: parseGuardianRelation(parentRelationRaw),
      parentPhone,
      parentEmail: parentEmail || undefined,
      parentProfession: parentProfession || undefined,
      guardian2Name: guardian2Name || undefined,
      guardian2Relation: guardian2Name ? parseGuardianRelation(guardian2RelationRaw) : undefined,
      guardian2Phone: guardian2Name ? guardian2Phone : undefined,
      guardian2Email: guardian2Name ? guardian2Email || undefined : undefined,
      guardian2Profession: guardian2Name ? guardian2Profession || undefined : undefined,
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
