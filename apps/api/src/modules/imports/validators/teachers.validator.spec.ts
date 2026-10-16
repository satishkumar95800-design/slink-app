import { ParsedTab } from '../types';
import { validateTeachersTab } from './teachers.validator';
import { TAB_HEADERS } from '../tab-schema';

function makeTab(rows: Array<Record<string, string>>): ParsedTab {
  return {
    headers: TAB_HEADERS.Teachers,
    extraColumns: [],
    rows: rows.map((cells, idx) => ({ rowNumber: idx + 2, cells })),
  };
}

const classes = [
  { row: 2, name: 'Grade 5', section: 'A', academicYear: '2025-26' },
];
const teacher = (phone: string, subject: string, yes: string) => ({
  'Teacher Name': `Teacher ${phone.slice(-1)}`,
  'Phone Number': phone,
  Email: '',
  'Class Name': 'Grade 5',
  Section: 'A',
  'Subject Name': subject,
  'Is Class Teacher': yes,
});

describe('validateTeachersTab — class teacher', () => {
  it('warns when two different teachers are marked class teacher of one class', () => {
    const result = validateTeachersTab(
      makeTab([
        teacher('+919800000001', 'Maths', 'Yes'),
        teacher('+919800000002', 'Science', 'Yes'),
      ]),
      classes,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      row: 3,
      column: 'Is Class Teacher',
    });
    expect(result.validRows.map((r) => r.isClassTeacher)).toEqual([true, true]);
  });

  it('does not warn for the same teacher on two subjects, or for "No" rows', () => {
    const result = validateTeachersTab(
      makeTab([
        teacher('+919800000001', 'Maths', 'Yes'),
        teacher('+919800000001', 'Science', 'Yes'),
        teacher('+919800000002', 'English', 'No'),
      ]),
      classes,
    );
    expect(
      result.warnings.filter((w) => w.column === 'Is Class Teacher'),
    ).toEqual([]);
  });
});
