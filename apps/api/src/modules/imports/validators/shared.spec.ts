import { cleanName, isAllLowercaseName } from './shared';

describe('name helpers', () => {
  it('cleanName trims and collapses inner whitespace', () => {
    expect(cleanName('  aarav \t  iyer ')).toBe('aarav iyer');
    expect(cleanName(undefined)).toBe('');
  });

  it('isAllLowercaseName flags only names with letters and no capitals', () => {
    expect(isAllLowercaseName('aarav iyer')).toBe(true);
    expect(isAllLowercaseName('Aarav iyer')).toBe(false);
    expect(isAllLowercaseName('AARAV')).toBe(false);
    expect(isAllLowercaseName('अनन्या')).toBe(false); // scripts without case are never flagged
    expect(isAllLowercaseName('123')).toBe(false);
  });
});
