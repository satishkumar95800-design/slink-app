import {
  addOnsOf,
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
      syllabus: true,
      hrms: false,
    });
    expect(presetFlags('premium_max')).toMatchObject({
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
});
