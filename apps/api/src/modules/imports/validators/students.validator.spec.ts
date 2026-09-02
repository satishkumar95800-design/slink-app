import { ParsedTab, ValidClassRow } from '../types';
import { validateStudentsTab } from './students.validator';

function makeTab(rows: Array<Record<string, string>>): ParsedTab {
  return {
    headers: [
      'Student Name',
      'Admission Number',
      'Class Name',
      'Section',
      'Date of Birth',
      'Parent Name',
      'Parent Mobile Number',
      'Parent Email',
    ],
    extraColumns: [],
    rows: rows.map((cells, idx) => ({ rowNumber: idx + 2, cells })),
  };
}

const CLASSES: ValidClassRow[] = [
  { row: 2, name: 'Grade 5', section: 'A', academicYear: '2025-26' },
  { row: 3, name: 'Grade 5', section: 'B', academicYear: '2025-26' },
  { row: 4, name: 'Grade 5', section: 'A', academicYear: '2024-25' },
];

function baseRow(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  return {
    'Student Name': 'Amy',
    'Admission Number': 'A1',
    'Class Name': 'Grade 5',
    Section: 'B',
    'Date of Birth': '2015-06-01',
    'Parent Name': 'Bob',
    'Parent Mobile Number': '+919876543210',
    'Parent Email': '',
    ...overrides,
  };
}

describe('validateStudentsTab', () => {
  it('accepts a valid row and resolves the class key unambiguously', () => {
    const result = validateStudentsTab(makeTab([baseRow()]), CLASSES);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].classKey).toContain('grade 5|b|2025-26');
  });

  it('requires the core fields', () => {
    const result = validateStudentsTab(
      makeTab([
        baseRow({
          'Student Name': '',
          'Admission Number': '',
          'Class Name': '',
          Section: '',
          'Parent Name': '',
          'Parent Mobile Number': '',
        }),
      ]),
      CLASSES,
    );
    expect(result.errors.map((e) => e.column)).toEqual(
      expect.arrayContaining([
        'Student Name',
        'Admission Number',
        'Class Name',
        'Section',
        'Parent Name',
        'Parent Mobile Number',
      ]),
    );
  });

  it('rejects an invalid Date of Birth format', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ 'Date of Birth': '06/01/2015' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Date of Birth')).toBe(true);
  });

  it('rejects a Parent Mobile Number not in E.164 format', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ 'Parent Mobile Number': '9876543210' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Parent Mobile Number')).toBe(
      true,
    );
  });

  it('errors when the referenced class+section does not exist', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ 'Class Name': 'Grade 9' })]),
      CLASSES,
    );
    expect(result.errors[0].reason).toMatch(/not found/);
  });

  it('errors when the class+section reference is ambiguous across academic years', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ Section: 'A' })]),
      CLASSES,
    );
    expect(result.errors[0].reason).toMatch(/matches 2 classes/);
  });

  it('flags duplicate admission numbers within the file', () => {
    const result = validateStudentsTab(
      makeTab([
        baseRow(),
        baseRow({ 'Student Name': 'Amy Two', 'Admission Number': 'a1' }),
      ]),
      CLASSES,
    );
    expect(result.validRows).toHaveLength(1);
    expect(
      result.errors.some((e) =>
        e.reason.includes('duplicate admission number'),
      ),
    ).toBe(true);
  });

  it('warns (not errors) when the same parent phone appears on multiple rows', () => {
    const result = validateStudentsTab(
      makeTab([
        baseRow({ 'Admission Number': 'A1' }),
        baseRow({ 'Student Name': 'Sibling', 'Admission Number': 'A2' }),
      ]),
      CLASSES,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].reason).toMatch(/linked to 2 students/);
  });

  it('accepts a valid Blood Group and Caste and translates blood group to the Prisma enum', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ 'Blood Group': 'A+', Caste: 'General' })]),
      CLASSES,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].bloodGroup).toBe('A_POSITIVE');
    expect(result.validRows[0].caste).toBe('General');
  });

  it('rejects an invalid Blood Group value', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ 'Blood Group': 'AB positive' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Blood Group')).toBe(true);
  });

  it('rejects an invalid Caste value', () => {
    const result = validateStudentsTab(
      makeTab([baseRow({ Caste: 'Unknown' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Caste')).toBe(true);
  });

  it('leaves Blood Group, Caste, and Parent Profession undefined when omitted (all optional)', () => {
    const result = validateStudentsTab(makeTab([baseRow()]), CLASSES);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0].bloodGroup).toBeUndefined();
    expect(result.validRows[0].caste).toBeUndefined();
    expect(result.validRows[0].parentProfession).toBeUndefined();
  });
});
