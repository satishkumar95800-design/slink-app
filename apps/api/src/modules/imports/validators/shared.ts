import { ImportIssue, ImportTabName, ValidClassRow } from '../types';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** E.164 phone format — matches the convention used by CreateStudentDto/LinkParentDto */
export const PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{2}$/;

export function isValidCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function issue(
  tab: ImportTabName,
  row: number,
  column: string | undefined,
  reason: string,
): ImportIssue {
  return { tab, row, column, reason };
}

/** Normalized lookup key for a class: name + section + academic year, case/whitespace-insensitive */
export function classKey(
  name: string,
  section: string,
  academicYear: string,
): string {
  return `${name.trim().toLowerCase()}|${section.trim().toLowerCase()}|${academicYear.trim()}`;
}

export function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

export type ClassResolution =
  | { status: 'resolved'; key: string }
  | { status: 'not_found' }
  | { status: 'ambiguous'; count: number };

/**
 * Students/Fee Structures rows reference a class by Name (+ optional Section) only —
 * neither tab has an Academic Year column. Resolve against the Classes tab's rows for
 * this import file; more than one match (e.g. same name+section across academic years,
 * or same name across sections when Section is omitted) can't be disambiguated here.
 */
export function resolveClass(
  classes: ValidClassRow[],
  name: string,
  section: string,
): ClassResolution {
  const matches = classes.filter(
    (c) =>
      normalizedName(c.name) === normalizedName(name) &&
      (!section || normalizedName(c.section) === normalizedName(section)),
  );
  if (matches.length === 0) return { status: 'not_found' };
  if (matches.length > 1) return { status: 'ambiguous', count: matches.length };
  return {
    status: 'resolved',
    key: classKey(matches[0].name, matches[0].section, matches[0].academicYear),
  };
}
