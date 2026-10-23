import {
  addOnsOf,
  branchListPrice,
  groupQuote,
  nextPeriodStart,
  oneYearFrom,
  presetFlags,
  subscriptionState,
  yearlyAmount,
} from './subscription';

describe('subscription rules', () => {
  it('runs a year from the start day', () => {
    expect(oneYearFrom('2026-10-17')).toBe('2027-10-16');
    expect(oneYearFrom('2027-01-01')).toBe('2027-12-31');
    expect(oneYearFrom('2028-02-29')).toBe('2029-02-28');
    expect(oneYearFrom('2027-03-01')).toBe('2028-02-29');
  });

  it('derives the status at each boundary', () => {
    const ends = '2027-10-16';
    expect(subscriptionState(ends, '2027-09-15').status).toBe('active'); // 31 days left
    expect(subscriptionState(ends, '2027-09-16')).toMatchObject({
      status: 'renewal_due',
      daysLeft: 30,
    });
    expect(subscriptionState(ends, '2027-10-16')).toMatchObject({
      status: 'renewal_due',
      daysLeft: 0,
    });
    expect(subscriptionState(ends, '2027-10-17')).toMatchObject({
      status: 'grace',
      graceDaysLeft: 6,
    });
    expect(subscriptionState(ends, '2027-10-23')).toMatchObject({
      status: 'grace',
      graceDaysLeft: 0,
    });
    expect(subscriptionState(ends, '2027-10-24').status).toBe('expired');
  });

  it('starts a renewal after the current end, or today once switched off', () => {
    expect(nextPeriodStart('2027-10-16', '2027-10-01')).toBe('2027-10-17');
    expect(nextPeriodStart('2027-10-16', '2027-10-20')).toBe('2027-10-17'); // in grace
    expect(nextPeriodStart('2027-10-16', '2027-12-01')).toBe('2027-12-01'); // expired
  });

  it('sets every plan-managed flag from the preset', () => {
    expect(presetFlags('basic').timetable).toBe(false);
    expect(presetFlags('premium')).toMatchObject({
      timetable: true,
      transport: true,
      syllabus: false,
      admissions: false,
      pettyCash: false,
      hrms: false,
    });
    expect(presetFlags('premium_max')).toMatchObject({
      syllabus: true,
      admissions: true,
      pettyCash: true,
      hrms: true,
      aiInsights: true,
    });
  });

  it('prices the plan, add-ons and students over the allowance', () => {
    const features = { ...presetFlags('premium'), hrms: true };
    expect(addOnsOf('premium', features)).toEqual(['hrms']);
    expect(yearlyAmount('premium', features, 1100)).toEqual({
      plan: 29999,
      addOns: 18000,
      extraStudents: 100,
      extraStudentsAmount: 3500,
      total: 51499,
    });
    expect(yearlyAmount('basic', {}, 300).total).toBe(13333);
  });

  it('prices a group by branch size with a volume discount and a head office fee', () => {
    const b = (
      i: number,
      students: number,
      plan: 'premium' | 'premium_max' = 'premium',
    ) => ({ id: `b${i}`, name: `B${i}`, plan, students });
    expect(branchListPrice('premium', 150)).toBe(12000);
    expect(branchListPrice('premium', 151)).toBe(20000);
    expect(branchListPrice('premium', 1100)).toBe(29999 + 100 * 30);
    expect(branchListPrice('premium_max', 100)).toBe(24000);

    // The spec's example: 12 branches of 100 → 15% off, head office included.
    const twelve = groupQuote(Array.from({ length: 12 }, (_, i) => b(i, 100)));
    expect(twelve).toMatchObject({
      groupPricing: true,
      discountPercent: 15,
      branchesTotal: 122400,
      headOfficeFee: 0,
      total: 122400,
    });

    const three = groupQuote([b(1, 100), b(2, 300), b(3, 100, 'premium_max')]);
    expect(three).toMatchObject({ discountPercent: 10, headOfficeFee: 15000 });
    expect(three.branchesTotal).toBe(
      Math.round(12000 * 0.9) +
        Math.round(20000 * 0.9) +
        Math.round(24000 * 0.9),
    );

    // Two branches: single-school prices, plus the head office fee.
    const two = groupQuote([b(1, 100), b(2, 100)]);
    expect(two).toMatchObject({
      groupPricing: false,
      discountPercent: 0,
      headOfficeFee: 15000,
      branchesTotal: 2 * 29999,
    });
  });
});
