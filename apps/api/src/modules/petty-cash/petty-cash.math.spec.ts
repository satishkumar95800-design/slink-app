import {
  LedgerRow,
  computeAdvances,
  computeBalance,
  daysBetween,
  fromPaise,
  needsApproval,
  outstandingOn,
  toPaise,
} from './petty-cash.math';

const row = (
  over: Partial<LedgerRow> & Pick<LedgerRow, 'id' | 'type' | 'amountPaise'>,
): LedgerRow => ({
  date: '2026-09-01',
  settlesEntryId: null,
  recipientKey: null,
  ...over,
});

describe('petty cash money maths', () => {
  it('converts rupees to exact integer paise and back', () => {
    expect(toPaise('12.50')).toBe(1250);
    expect(toPaise(12.5)).toBe(1250);
    expect(toPaise('0.07')).toBe(7);
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise({ toString: () => '1000' })).toBe(100000);
    expect(fromPaise(1250)).toBe('12.50');
    expect(fromPaise(5)).toBe('0.05');
    expect(fromPaise(-250)).toBe('-2.50');
  });

  it('rejects amounts with more than two decimals', () => {
    expect(() => toPaise('1.234')).toThrow();
    expect(() => toPaise('abc')).toThrow();
  });

  it('has no floating point drift over many small entries', () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      row({ id: `t${i}`, type: 'TOP_UP', amountPaise: toPaise('0.10') }),
    );
    expect(computeBalance(rows)).toBe(10000);
  });

  describe('balance', () => {
    it('adds top-ups and returns, subtracts disbursements and direct expenses', () => {
      const rows = [
        row({ id: 't', type: 'TOP_UP', amountPaise: 100000 }),
        row({ id: 'd', type: 'DISBURSEMENT', amountPaise: 30000 }),
        row({ id: 'e', type: 'EXPENSE', amountPaise: 10000 }),
        row({
          id: 'r',
          type: 'RETURN',
          amountPaise: 5000,
          settlesEntryId: 'd',
        }),
      ];
      expect(computeBalance(rows)).toBe(100000 - 30000 - 10000 + 5000);
    });

    it('does not move the float when an expense settles a disbursement', () => {
      const rows = [
        row({ id: 't', type: 'TOP_UP', amountPaise: 50000 }),
        row({ id: 'd', type: 'DISBURSEMENT', amountPaise: 20000 }),
        row({
          id: 'e',
          type: 'EXPENSE',
          amountPaise: 20000,
          settlesEntryId: 'd',
        }),
      ];
      expect(computeBalance(rows)).toBe(30000);
    });

    it('is zero for an empty ledger', () => {
      expect(computeBalance([])).toBe(0);
    });
  });

  describe('advances', () => {
    const base = [
      row({
        id: 'd',
        type: 'DISBURSEMENT',
        amountPaise: 100000,
        date: '2026-10-01',
        recipientKey: 'u:1',
      }),
    ];

    it('is open until approved expenses plus returns equal the amount', () => {
      const rows = [
        ...base,
        row({
          id: 'e1',
          type: 'EXPENSE',
          amountPaise: 60000,
          settlesEntryId: 'd',
        }),
      ];
      expect(outstandingOn('d', rows)).toBe(40000);
      rows.push(
        row({
          id: 'r1',
          type: 'RETURN',
          amountPaise: 40000,
          settlesEntryId: 'd',
        }),
      );
      expect(outstandingOn('d', rows)).toBe(0);
    });

    it('flags overdue only when still open past the configured days', () => {
      const [a] = computeAdvances(base, 7, '2026-10-08');
      expect(a.ageDays).toBe(7);
      expect(a.overdue).toBe(false);
      expect(computeAdvances(base, 7, '2026-10-09')[0].overdue).toBe(true);
    });

    it('never flags a fully settled advance as overdue', () => {
      const rows = [
        ...base,
        row({
          id: 'e',
          type: 'EXPENSE',
          amountPaise: 100000,
          settlesEntryId: 'd',
        }),
      ];
      const [a] = computeAdvances(rows, 7, '2026-12-01');
      expect(a.outstandingPaise).toBe(0);
      expect(a.overdue).toBe(false);
    });
  });

  it('gates strictly above the threshold', () => {
    expect(needsApproval(200000, 200000)).toBe(false);
    expect(needsApproval(200001, 200000)).toBe(true);
    expect(needsApproval(1, 0)).toBe(true);
  });

  it('counts days across month ends', () => {
    expect(daysBetween('2026-01-30', '2026-02-02')).toBe(3);
  });
});
