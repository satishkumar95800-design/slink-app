import { ParsedTab } from '../types';
import { validateClassesTab } from './classes.validator';

function makeTab(rows: Array<Record<string, string>>): ParsedTab {
  return {
    headers: ['Class Name', 'Section', 'Academic Year', 'Class Teacher Email'],
    extraColumns: [],
    rows: rows.map((cells, idx) => ({ rowNumber: idx + 2, cells })),
  };
}

describe('validateClassesTab', () => {
  it('accepts a valid row', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': '',
        },
      ]),
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      name: 'Grade 5',
      section: 'A',
      academicYear: '2025-26',
    });
  });

  it('requires Class Name, Section, and Academic Year', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': '',
          Section: '',
          'Academic Year': '',
          'Class Teacher Email': '',
        },
      ]),
    );
    expect(result.errors.map((e) => e.column)).toEqual(
      expect.arrayContaining(['Class Name', 'Section', 'Academic Year']),
    );
    expect(result.validRows).toHaveLength(0);
  });

  it('rejects an academic year not in YYYY-YY format', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025',
          'Class Teacher Email': '',
        },
      ]),
    );
    expect(result.errors[0].reason).toMatch(/YYYY-YY/);
  });

  it('rejects an invalid Class Teacher Email', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': 'not-an-email',
        },
      ]),
    );
    expect(result.errors[0].column).toBe('Class Teacher Email');
  });

  it('flags duplicate Class Name+Section+Academic Year within the file', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': '',
        },
        {
          'Class Name': 'grade 5',
          Section: 'a',
          'Academic Year': '2025-26',
          'Class Teacher Email': '',
        },
      ]),
    );
    expect(result.validRows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toMatch(/Duplicate/);
  });

  it('allows the same Class Name with different Sections', () => {
    const result = validateClassesTab(
      makeTab([
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': '',
        },
        {
          'Class Name': 'Grade 5',
          Section: 'B',
          'Academic Year': '2025-26',
          'Class Teacher Email': '',
        },
      ]),
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);
  });
});
