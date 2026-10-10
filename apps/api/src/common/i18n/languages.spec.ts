import { effectiveLanguage, isLanguage } from './languages';

describe('effectiveLanguage', () => {
  it("prefers the user's choice, then the school default, then English", () => {
    expect(effectiveLanguage('kn', 'hi')).toBe('kn');
    expect(effectiveLanguage(null, 'hi')).toBe('hi');
    expect(effectiveLanguage(undefined, undefined)).toBe('en');
  });

  it('ignores values that are not supported languages', () => {
    expect(effectiveLanguage('ta', 'xx')).toBe('en');
    expect(effectiveLanguage('fr', 'kn')).toBe('kn');
    expect(isLanguage('EN')).toBe(false);
    expect(isLanguage(3)).toBe(false);
  });
});
