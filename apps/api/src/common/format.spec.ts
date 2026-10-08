import { formatDateOnly, formatRupees } from './format';

describe('formatRupees', () => {
  it.each([
    [21400, '₹21,400'],
    [125000, '₹1,25,000'],
    [12345678, '₹1,23,45,678'],
    ['1234.5', '₹1,234.50'],
    [0, '₹0'],
    ['not a number', '₹0'],
  ])('%p -> %p', (input, expected) => {
    expect(formatRupees(input)).toBe(expected);
  });
});

describe('formatDateOnly', () => {
  it('formats a date-only value as DD/MM/YYYY', () => {
    expect(formatDateOnly(new Date('2026-10-08T00:00:00.000Z'))).toBe('08/10/2026');
  });
});
