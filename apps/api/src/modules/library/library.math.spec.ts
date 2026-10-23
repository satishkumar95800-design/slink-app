import {
  addDays,
  daysLate,
  finePaise,
  nextAccessionNumbers,
} from './library.math';

describe('library math', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-25', 14)).toBe('2026-11-08');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('counts days late, zero on or before the due date', () => {
    expect(daysLate('2026-11-08', '2026-11-08')).toBe(0);
    expect(daysLate('2026-11-08', '2026-11-01')).toBe(0);
    expect(daysLate('2026-11-08', '2026-11-11')).toBe(3);
  });

  it('fines per day late', () => {
    expect(finePaise('2026-11-08', '2026-11-11', 200)).toBe(600);
    expect(finePaise('2026-11-08', '2026-11-08', 200)).toBe(0);
    expect(finePaise('2026-11-08', '2026-11-11', 0)).toBe(0);
  });

  it('numbers new copies after the highest numeric accession number', () => {
    expect(nextAccessionNumbers(['1', '2', '10', 'REF-4'], 3)).toEqual([
      '11',
      '12',
      '13',
    ]);
    expect(nextAccessionNumbers([], 2)).toEqual(['1', '2']);
  });
});
