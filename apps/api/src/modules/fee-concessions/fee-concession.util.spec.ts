import { FeeStatus, Prisma } from '@prisma/client';
import {
  concessionReductions,
  type ConcessionComponent,
} from './fee-concession.util';

const d = (v: string | number) => new Prisma.Decimal(v);

function comp(
  id: string,
  amountDue: number,
  amountPaid = 0,
  feeItemId = 'tuition',
  status: FeeStatus = FeeStatus.pending,
): ConcessionComponent {
  return {
    id,
    feeItemId,
    amountDue: d(amountDue),
    amountPaid: d(amountPaid),
    status,
  };
}

describe('concessionReductions', () => {
  it('takes the percentage off each unpaid component', () => {
    const r = concessionReductions(
      [comp('a', 10000), comp('b', 5000)],
      d(10),
      null,
    );
    expect(r.get('a')?.toFixed(2)).toBe('1000.00');
    expect(r.get('b')?.toFixed(2)).toBe('500.00');
  });

  it('only reduces the unpaid balance of a part-paid component', () => {
    const r = concessionReductions([comp('a', 10000, 4000)], d(50), null);
    expect(r.get('a')?.toFixed(2)).toBe('3000.00');
  });

  it('skips paid and waived components', () => {
    const r = concessionReductions(
      [
        comp('paid', 1000, 1000),
        comp('waived', 1000, 0, 'tuition', FeeStatus.waived),
      ],
      d(10),
      null,
    );
    expect(r.size).toBe(0);
  });

  it('limits to one fee item when given', () => {
    const r = concessionReductions(
      [comp('a', 1000), comp('t', 1000, 0, 'transport')],
      d(10),
      'tuition',
    );
    expect([...r.keys()]).toEqual(['a']);
  });

  it('rounds to paise', () => {
    const r = concessionReductions([comp('a', 333.33)], d(12.5), null);
    expect(r.get('a')?.toFixed(2)).toBe('41.67');
  });

  it('100% clears the unpaid balance exactly', () => {
    const r = concessionReductions([comp('a', 1234.56, 234.56)], d(100), null);
    expect(r.get('a')?.toFixed(2)).toBe('1000.00');
  });
});
