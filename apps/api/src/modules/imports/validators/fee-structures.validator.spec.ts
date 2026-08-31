import { ParsedTab, ValidClassRow } from '../types';
import { validateFeeStructuresTab } from './fee-structures.validator';

function makeTab(rows: Array<Record<string, string>>): ParsedTab {
  return {
    headers: [
      'Class Name',
      'Section',
      'Term',
      'Fee Component',
      'Amount',
      'Due Date',
      'Late Fee',
    ],
    extraColumns: [],
    rows: rows.map((cells, idx) => ({ rowNumber: idx + 2, cells })),
  };
}

const CLASSES: ValidClassRow[] = [
  { row: 2, name: 'Grade 5', section: 'A', academicYear: '2025-26' },
];

function baseRow(
  overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
  return {
    'Class Name': 'Grade 5',
    Section: 'A',
    Term: 'Term 1',
    'Fee Component': 'Tuition',
    Amount: '10000',
    'Due Date': '2025-06-01',
    'Late Fee': '50',
    ...overrides,
  };
}

describe('validateFeeStructuresTab', () => {
  it('accepts a valid row', () => {
    const result = validateFeeStructuresTab(makeTab([baseRow()]), CLASSES);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0]).toMatchObject({
      term: 'Term 1',
      feeComponent: 'Tuition',
      amount: 10000,
      lateFee: 50,
    });
  });

  it('requires Class Name, Term, Fee Component, Amount, and Due Date', () => {
    const result = validateFeeStructuresTab(
      makeTab([
        baseRow({
          'Class Name': '',
          Term: '',
          'Fee Component': '',
          Amount: '',
          'Due Date': '',
        }),
      ]),
      CLASSES,
    );
    expect(result.errors.map((e) => e.column)).toEqual(
      expect.arrayContaining([
        'Class Name',
        'Term',
        'Fee Component',
        'Amount',
        'Due Date',
      ]),
    );
  });

  it('rejects a non-positive Amount', () => {
    const result = validateFeeStructuresTab(
      makeTab([baseRow({ Amount: '0' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Amount')).toBe(true);
  });

  it('rejects an invalid Due Date format', () => {
    const result = validateFeeStructuresTab(
      makeTab([baseRow({ 'Due Date': '01-06-2025' })]),
      CLASSES,
    );
    expect(result.errors.some((e) => e.column === 'Due Date')).toBe(true);
  });

  it('resolves a class reference without Section when unambiguous', () => {
    const result = validateFeeStructuresTab(
      makeTab([baseRow({ Section: '' })]),
      CLASSES,
    );
    expect(result.errors).toHaveLength(0);
  });

  it('errors when the class reference does not exist', () => {
    const result = validateFeeStructuresTab(
      makeTab([baseRow({ 'Class Name': 'Grade 9' })]),
      CLASSES,
    );
    expect(result.errors[0].reason).toMatch(/not found/);
  });

  it('errors on ambiguous class reference across sections when Section is omitted', () => {
    const classes: ValidClassRow[] = [
      { row: 2, name: 'Grade 5', section: 'A', academicYear: '2025-26' },
      { row: 3, name: 'Grade 5', section: 'B', academicYear: '2025-26' },
    ];
    const result = validateFeeStructuresTab(
      makeTab([baseRow({ Section: '' })]),
      classes,
    );
    expect(result.errors[0].reason).toMatch(/matches 2 classes/);
  });

  it('flags a duplicate Fee Component within the same Class/Section/Term group', () => {
    const result = validateFeeStructuresTab(
      makeTab([baseRow(), baseRow({ Amount: '500' })]),
      CLASSES,
    );
    expect(result.validRows).toHaveLength(1);
    expect(
      result.errors.some((e) => e.reason.includes('duplicate component')),
    ).toBe(true);
  });

  it('warns when Due Date or Late Fee disagree within the same group', () => {
    const result = validateFeeStructuresTab(
      makeTab([
        baseRow(),
        baseRow({
          'Fee Component': 'Transport',
          'Due Date': '2025-07-01',
          'Late Fee': '100',
        }),
      ]),
      CLASSES,
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);
    expect(result.warnings.some((w) => w.column === 'Due Date')).toBe(true);
    expect(result.warnings.some((w) => w.column === 'Late Fee')).toBe(true);
  });
});
