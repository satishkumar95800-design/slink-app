import { presetFlags } from '../../common/subscription';
import { SchoolFacts, buildDashboard } from './platform-insights';

const school = (over: Partial<SchoolFacts>): SchoolFacts => ({
  id: over.name ?? 's',
  name: 's',
  isActive: true,
  ageDays: 100,
  plan: 'premium',
  features: presetFlags('premium'),
  status: 'active',
  daysLeft: 200,
  yearlyTotal: 29999,
  addOns: [],
  students: 300,
  staff: 20,
  studentsWithAppParent: 250,
  attendanceLast7: 1000,
  ...over,
});
const kinds = (list: SchoolFacts[], leads = { last7: 0, last30: 0 }) =>
  buildDashboard(list, leads).suggestions.map((s) => s.kind);

describe('platform dashboard rules', () => {
  it('is quiet for a healthy school', () => {
    expect(kinds([school({ name: 'ok' })])).toEqual([]);
  });

  it('flags renewals due and in grace, but not 31 days out', () => {
    expect(kinds([school({ status: 'renewal_due', daysLeft: 12 })])).toContain(
      'renew_soon',
    );
    expect(kinds([school({ status: 'grace', daysLeft: -3 })])).toContain(
      'renew_soon',
    );
    expect(kinds([school({ status: 'active', daysLeft: 31 })])).not.toContain(
      'renew_soon',
    );
    expect(kinds([school({ status: 'expired', daysLeft: -20 })])).toEqual([
      'switched_off',
    ]);
  });

  it('charges students over the allowance', () => {
    const d = buildDashboard([school({ students: 1050 })], {
      last7: 0,
      last30: 0,
    });
    const s = d.suggestions.find((x) => x.kind === 'extra_students')!;
    expect(s.amount).toBe(50 * 35);
    expect(kinds([school({ students: 1000 })])).not.toContain('extra_students');
  });

  it('suggests upgrades', () => {
    expect(
      kinds([
        school({
          plan: 'basic',
          features: {},
          students: 401,
          studentsWithAppParent: 401,
        }),
      ]),
    ).toContain('upgrade_premium');
    expect(
      kinds([
        school({
          plan: 'basic',
          features: { timetable: true, calendar: true },
        }),
      ]),
    ).toContain('upgrade_premium');
    expect(
      kinds([school({ plan: 'basic', features: { timetable: true } })]),
    ).not.toContain('upgrade_premium');
    expect(
      kinds([
        school({
          features: { ...presetFlags('premium'), hrms: true, aiInsights: true },
        }),
      ]),
    ).toContain('upgrade_premium_max');
    expect(
      kinds([school({ features: { ...presetFlags('premium'), hrms: true } })]),
    ).not.toContain('upgrade_premium_max');
  });

  it('spots low app use, idle attendance and schools not set up', () => {
    expect(
      kinds([school({ students: 100, studentsWithAppParent: 39 })]),
    ).toContain('low_app_use');
    expect(
      kinds([school({ students: 100, studentsWithAppParent: 40 })]),
    ).not.toContain('low_app_use');
    expect(
      kinds([school({ students: 10, studentsWithAppParent: 0 })]),
    ).not.toContain('low_app_use');
    expect(kinds([school({ attendanceLast7: 0 })])).toContain('no_attendance');
    expect(kinds([school({ attendanceLast7: 0, ageDays: 10 })])).not.toContain(
      'no_attendance',
    );
    expect(
      kinds([
        school({
          students: 0,
          studentsWithAppParent: 0,
          attendanceLast7: 0,
          ageDays: 20,
        }),
      ]),
    ).toEqual(['not_set_up']);
  });

  it('adds lead follow-up and totals revenue without switched-off schools', () => {
    const d = buildDashboard(
      [
        school({ name: 'a' }),
        school({ name: 'b', status: 'expired', daysLeft: -30 }),
        school({ name: 'c', isActive: false }),
      ],
      { last7: 2, last30: 5 },
    );
    expect(d.suggestions.map((s) => s.kind)).toContain('follow_up_leads');
    expect(d.totals).toMatchObject({ schools: 3, active: 2, inactive: 1 });
    expect(d.revenue.contracted).toBe(29999);
    expect(d.revenue.overdue).toBe(29999);
  });
});
