/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, -- jest mock calls */
import { AiUnavailableError } from '../ai/ai.service';
import {
  PettyCashForecastService,
  numbersIn,
  onlyRestatesGivenNumbers,
} from './petty-cash-forecast.service';

const snapshot = (months: number) => ({
  today: '2026-10-15',
  settings: {
    thresholdPaise: 0,
    monthlyBudgetPaise: null,
    receiptAbovePaise: 0,
    overdueDays: 7,
  },
  balancePaise: 0,
  categories: [{ id: 'c1', name: 'Stationery', budgetPaise: null }],
  expenses: Array.from({ length: months }, (_, i) => ({
    id: `e${i}`,
    date: `2026-0${9 - i}-05`,
    amountPaise: 200000 + i * 0,
    categoryId: 'c1',
  })).reverse(),
  advances: [],
});

// Rising spend so a trend finding exists.
const risingSnapshot = () => {
  const s = snapshot(3);
  s.expenses = [
    { id: 'a', date: '2026-07-05', amountPaise: 200000, categoryId: 'c1' },
    { id: 'b', date: '2026-08-05', amountPaise: 260000, categoryId: 'c1' },
    { id: 'c', date: '2026-09-05', amountPaise: 350000, categoryId: 'c1' },
  ];
  return s;
};

function setup(snap: unknown, ai: Record<string, jest.Mock>) {
  const petty = {
    forecastSnapshot: jest.fn().mockResolvedValue(snap),
    tenantLanguage: jest.fn().mockResolvedValue('en'),
  };
  return {
    petty,
    service: new PettyCashForecastService(petty as never, ai as never),
  };
}

describe('numbers guard', () => {
  it('extracts and normalises numbers', () => {
    expect(numbersIn('Rs 1,25,000.50 and 12.0 and 7')).toEqual([
      '125000.50',
      '12',
      '7',
    ]);
  });
  it('accepts replies that only restate given numbers', () => {
    expect(
      onlyRestatesGivenNumbers('- Stationery rose 75%', 'rose 75 percent'),
    ).toBe(true);
    expect(
      onlyRestatesGivenNumbers('- Save 900 rupees', 'rose 75 percent'),
    ).toBe(false);
  });
});

describe('PettyCashForecastService', () => {
  it('returns ready:false with the months of data when there is too little history', async () => {
    const ai = { isAvailable: jest.fn(), complete: jest.fn() };
    const { service } = setup(snapshot(2), ai);
    expect(await service.forecast('t')).toEqual({
      ready: false,
      monthsOfData: 2,
      needed: 3,
    });
    expect(await service.advice('t')).toEqual({
      ready: false,
      monthsOfData: 2,
      needed: 3,
    });
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('uses template text and never calls the model without aiInsights', async () => {
    const ai = {
      isAvailable: jest.fn().mockResolvedValue(false),
      complete: jest.fn(),
    };
    const { service } = setup(risingSnapshot(), ai);
    const r = await service.advice('t');
    expect(r).toMatchObject({ ready: true, source: 'template' });
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('phrases findings with the model when it is available and keeps to the given numbers', async () => {
    const ai = {
      isAvailable: jest.fn().mockResolvedValue(true),
      complete: jest
        .fn()
        .mockResolvedValue('- Stationery spending is rising by 75% a month.'),
    };
    const { service } = setup(risingSnapshot(), ai);
    const r = await service.advice('tenant-1');
    expect(r).toMatchObject({ ready: true, source: 'ai' });
    const req = ai.complete.mock.calls[0][0];
    expect(req).toMatchObject({
      tenantId: 'tenant-1',
      feature: 'petty_cash_advice',
    });
    expect(req.system).toMatch(/ONLY the facts/);
  });

  it('falls back to the template when the reply invents a number', async () => {
    const ai = {
      isAvailable: jest.fn().mockResolvedValue(true),
      complete: jest.fn().mockResolvedValue('- You could save 12345 rupees.'),
    };
    const { service } = setup(risingSnapshot(), ai);
    expect(await service.advice('t')).toMatchObject({
      source: 'template',
      fallbackReason: 'unverified_numbers',
    });
  });

  it('falls back when the model is over its cap or fails', async () => {
    const ai = {
      isAvailable: jest.fn().mockResolvedValue(true),
      complete: jest
        .fn()
        .mockRejectedValue(new AiUnavailableError('over_budget')),
    };
    const { service } = setup(risingSnapshot(), ai);
    expect(await service.advice('t')).toMatchObject({
      source: 'template',
      fallbackReason: 'over_budget',
    });
  });
});
