import { ParsedTab } from '../types';
import { validateUsersTab } from './users.validator';

function makeTab(rows: Array<Record<string, string>>): ParsedTab {
  return {
    headers: ['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)'],
    extraColumns: [],
    rows: rows.map((cells, idx) => ({ rowNumber: idx + 2, cells })),
  };
}

describe('validateUsersTab', () => {
  it('accepts a valid teacher row', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane Doe',
          Email: 'jane@school.edu',
          'Phone Number': '',
          Role: 'teacher',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.errors).toHaveLength(0);
    expect(result.validRows[0]).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@school.edu',
      role: 'teacher',
    });
  });

  it('requires Full Name, Email, and Role', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': '',
          Email: '',
          'Phone Number': '',
          Role: '',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.errors.map((e) => e.column)).toEqual(
      expect.arrayContaining(['Full Name', 'Email', 'Role']),
    );
  });

  it('rejects an invalid email', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'not-an-email',
          'Phone Number': '',
          Role: 'teacher',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.errors.some((e) => e.column === 'Email')).toBe(true);
  });

  it('rejects a role outside admin/accounts/teacher', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'jane@school.edu',
          'Phone Number': '',
          Role: 'parent',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.errors.some((e) => e.column === 'Role')).toBe(true);
  });

  it('rejects a phone number not in E.164 format', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'jane@school.edu',
          'Phone Number': '9876543210',
          Role: 'teacher',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.errors.some((e) => e.column === 'Phone Number')).toBe(true);
  });

  it('flags an Assigned Class not present in the Classes tab', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'jane@school.edu',
          'Phone Number': '',
          Role: 'teacher',
          'Assigned Class (Teachers only)': 'Grade 9',
        },
      ]),
      new Set(['grade 5']),
    );
    expect(result.errors.some((e) => e.column === 'Assigned Class (Teachers only)')).toBe(true);
  });

  it('accepts an Assigned Class present in the Classes tab (case-insensitive)', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'jane@school.edu',
          'Phone Number': '',
          Role: 'teacher',
          'Assigned Class (Teachers only)': 'GRADE 5',
        },
      ]),
      new Set(['grade 5']),
    );
    expect(result.errors).toHaveLength(0);
  });

  it('flags duplicate emails within the file', () => {
    const result = validateUsersTab(
      makeTab([
        {
          'Full Name': 'Jane',
          Email: 'jane@school.edu',
          'Phone Number': '',
          Role: 'teacher',
          'Assigned Class (Teachers only)': '',
        },
        {
          'Full Name': 'Jane Two',
          Email: 'JANE@school.edu',
          'Phone Number': '',
          Role: 'accounts',
          'Assigned Class (Teachers only)': '',
        },
      ]),
      new Set(),
    );
    expect(result.validRows).toHaveLength(1);
    expect(
      result.errors.some((e) => e.reason.includes('duplicate email')),
    ).toBe(true);
  });
});
