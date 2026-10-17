import {
  DenominationError,
  applyMovements,
  countsText,
  countsTotalPaise,
  netPaise,
  normalizeCounts,
  normalizeNotes,
} from './petty-cash.denominations';

describe('petty cash denominations', () => {
  it('keeps known denominations and drops zeros', () => {
    expect(normalizeCounts({ '500': 2, '10': 0, '1': 3 })).toEqual({
      '500': 2,
      '1': 3,
    });
    expect(normalizeCounts(undefined)).toEqual({});
  });

  it('rejects unknown notes, fractions and negatives', () => {
    expect(() => normalizeCounts({ '2000': 1 })).toThrow(DenominationError);
    expect(() => normalizeCounts({ '100': 1.5 })).toThrow(DenominationError);
    expect(() => normalizeCounts({ '100': -1 })).toThrow(DenominationError);
    expect(() => normalizeCounts({ '100': '2' })).toThrow(DenominationError);
    expect(() => normalizeCounts([1])).toThrow(DenominationError);
    expect(() => normalizeNotes({ in: {}, sideways: {} })).toThrow(
      DenominationError,
    );
  });

  it('totals in paise and nets in minus out', () => {
    expect(countsTotalPaise({ '500': 2, '20': 1 })).toBe(102_000);
    // Gave a 500, got 20 back: 480 left the box.
    expect(netPaise({ in: { '20': 1 }, out: { '500': 1 } })).toBe(-48_000);
  });

  it('applies movements to a count, allowing a negative to show drift', () => {
    const stock = applyMovements({ '500': 2, '100': 1 }, [
      { in: { '20': 1 }, out: { '500': 1 } },
      { in: {}, out: { '100': 2 } },
    ]);
    expect(stock['500']).toBe(1);
    expect(stock['100']).toBe(-1);
    expect(stock['20']).toBe(1);
    expect(stock['1']).toBe(0);
  });

  it('writes counts largest note first', () => {
    expect(countsText({ '10': 1, '500': 2 })).toBe('500 x 2, 10 x 1');
  });
});
