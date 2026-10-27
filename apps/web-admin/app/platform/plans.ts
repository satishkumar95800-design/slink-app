/**
 * Plans, modules and subscription status for the platform console
 * (docs/SPEC-subscriptions.md). Grouped like the price list
 * (Schoolinkd_Plans_and_Pricing_2026-27.pdf); prices match the API's
 * pricing-plans.ts, which is the source for the PDF.
 */

export type PlanKey = 'basic' | 'premium' | 'premium_max';
export type SubscriptionStatus = 'trial' | 'active' | 'renewal_due' | 'grace' | 'expired';

export interface Subscription {
  plan: PlanKey;
  planName: string;
  startsOn: string;
  endsOn: string;
  status: SubscriptionStatus;
  /** Free trial (still running, or ended without a renewal). */
  onTrial?: boolean;
  daysLeft: number;
  graceDaysLeft: number | null;
  addOns: string[];
  yearlyAmount: { plan: number; addOns: number; extraStudents: number; extraStudentsAmount: number; total: number; groupDiscountPercent?: number };
}

export const PLANS: { key: PlanKey; name: string; price: number; students: number; extraStudent: number }[] = [
  { key: 'basic', name: 'Basic', price: 15000, students: 400, extraStudent: 40 },
  { key: 'premium', name: 'Premium', price: 40000, students: 1000, extraStudent: 35 },
  { key: 'premium_max', name: 'Premium Max', price: 65000, students: 2000, extraStudent: 30 },
];

export const planName = (key: PlanKey) => PLANS.find((p) => p.key === key)?.name ?? key;

/** In every plan; shown read-only (price list "Everything in Basic"). */
export const INCLUDED_IN_ALL = [
  'Parent and teacher mobile app (Android and iPhone)',
  'Daily attendance with absence alerts',
  'Notices and homework with "seen by" tracking',
  'Fee structures, receipts and online payment',
  'Automatic fee-due reminders',
  'Progress reports to parents',
  'English, Kannada and Hindi',
  'Excel import of classes, staff, students and fees',
];

export type ModuleGroup = 'premium' | 'premium_max';

export const MODULES = [
  { key: 'timetable', group: 'premium', name: 'Timetable', help: 'Weekly timetable and bell times, the teacher’s weekly routine and today’s periods in the app, and next-class reminders.' },
  { key: 'calendar', group: 'premium', name: 'School calendar and PTMs', help: 'Holidays, events, parent-teacher meetings and event consent forms in the apps.' },
  { key: 'staffDocuments', group: 'premium', name: 'Shared staff documents', help: 'Shared folders and files for teachers, admin and accounts.' },
  { key: 'advancedReports', group: 'premium', name: 'Attendance and fee reports', help: 'Attendance report and Fee reports with CSV download. Dashboard totals stay on without it.' },
  { key: 'feeConcession', group: 'premium', name: 'Fee concessions', help: 'Percentage concession on a student’s unpaid fees.' },
  { key: 'transferCertificate', group: 'premium', name: 'Transfer certificates', help: 'TC upload on the student page and a "TC not attached" report.' },
  { key: 'pettyCash', group: 'premium_max', name: 'Petty cash', help: 'Cash ledger with approvals, advances, notes in hand and savings advice.' },
  { key: 'customBranding', group: 'premium', name: 'School background and colours', help: 'The school changes its own background, logo and colours.' },
  { key: 'syllabus', group: 'premium_max', name: 'Syllabus progress', help: 'Topic plans with target dates; teachers tick topics off, parents see coverage, the admin sees subjects running late.' },
  { key: 'admissions', group: 'premium_max', name: 'Admissions and front desk', help: 'Enquiry, campus tour, follow-up, registration and enrolment, with follow-up reminders and a funnel (also on the head office view); the receptionist\'s front desk with visitors, calls and desk receipts.' },
  { key: 'transport', group: 'premium', name: 'School bus routes', help: 'Bus routes with stops and times, drivers and attendants (kept on the School bus page), students per route; parents see their child’s bus and can call the driver.' },
  { key: 'hrms', group: 'premium_max', name: 'HR and payroll', help: 'Staff records, attendance, leave, pay runs with PF, ESI, PT and payslips. Add-on for Premium (₹18,000).' },
  { key: 'busTracking', group: 'premium_max', name: 'Live bus tracking', help: 'The driver starts a trip in the app and parents see the bus move on a map. Needs School bus routes.' },
  { key: 'library', group: 'premium_max', name: 'Library', help: 'Book catalogue with copies, issue and return at the desk, overdue list and fines; parents see their child’s borrowed books.' },
  { key: 'loginCodes', group: 'premium_max', name: 'Sign-in codes', help: 'The school admin can require a code sent by email at every console sign-in with a password.' },
  { key: 'photoAlbums', group: 'premium_max', name: 'Photo albums', help: 'Activity photos for the parents of chosen classes or children: they view and save them for 30 days, then the photos are deleted.' },
  { key: 'aiInsights', group: 'premium_max', name: 'AI features', help: 'AI assistant, notice translation, report remarks, early warnings and Monday summary. Add-on for Premium (₹15,000).' },
] as const satisfies readonly { key: string; group: ModuleGroup; name: string; help: string }[];

export type ModuleKey = (typeof MODULES)[number]['key'];

export const PRESETS: Record<PlanKey, ModuleKey[]> = {
  basic: [],
  premium: MODULES.filter((m) => m.group === 'premium').map((m) => m.key),
  premium_max: MODULES.map((m) => m.key),
};

/** Every module flag set to the plan's preset. */
export const presetFlags = (plan: PlanKey) =>
  Object.fromEntries(MODULES.map((m) => [m.key, PRESETS[plan].includes(m.key)])) as Record<ModuleKey, boolean>;

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Free trial',
  active: 'Active',
  renewal_due: 'Renewal due',
  grace: 'Grace period',
  expired: 'Switched off',
};

export const STATUS_VARIANT = {
  trial: 'blue',
  active: 'green',
  renewal_due: 'yellow',
  grace: 'orange',
  expired: 'red',
} as const satisfies Record<SubscriptionStatus, string>;

export const PLAN_VARIANT = {
  basic: 'gray',
  premium: 'blue',
  premium_max: 'purple',
} as const satisfies Record<PlanKey, string>;

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** DD/MM/YYYY from YYYY-MM-DD. */
export const dmy = (ymd: string) => ymd.split('-').reverse().join('/');

/** "12 days left", "ends today", "3 days over". */
export function daysText(s: Subscription) {
  if (s.daysLeft > 0) return `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left`;
  if (s.daysLeft === 0) return 'Ends today';
  const over = -s.daysLeft;
  return `${over} day${over === 1 ? '' : 's'} over`;
}

export const addDays = (ymd: string, n: number) =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Mirrors the API: the day before the same date next year (29 Feb → 28 Feb). */
/** A new school's free trial, counting the first day (API TRIAL_DAYS). */
export const TRIAL_DAYS = 14;
export const trialEndsOn = (start: string) => addDays(start, TRIAL_DAYS - 1);

export function oneYearFrom(start: string) {
  const [y, m, d] = start.split('-').map(Number);
  if (m === 2 && d === 29) return `${y + 1}-02-28`;
  return addDays(`${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, -1);
}

/**
 * Group (franchise) pricing, mirroring FRANCHISE_PRICING in the API's
 * pricing-plans.ts (docs/SPEC-franchise.md §5). Used by the quote calculator.
 */
export const FRANCHISE = {
  minBranches: 3,
  bands: [
    { upTo: 150, price: 12000, label: 'Up to 150 students' },
    { upTo: 500, price: 20000, label: '151 to 500 students' },
    { upTo: 1000, price: 29999, label: '501 to 1,000 students' },
  ],
  extraStudent: 30,
  premiumMaxAddOn: 12000,
  discounts: [
    { minBranches: 25, percent: 20 },
    { minBranches: 10, percent: 15 },
    { minBranches: 3, percent: 10 },
  ],
  headOffice: { price: 15000, freeFromBranches: 10 },
} as const;

export interface GroupQuote {
  groupPricing: boolean;
  discountPercent: number;
  branches: { id: string; name: string; students: number; listPrice: number; price: number }[];
  branchesTotal: number;
  headOfficeFee: number;
  total: number;
}

/** Estimate for N branches of about the same size (sales calculator). */
export function estimateGroup(branches: number, studentsEach: number, premiumMax: boolean) {
  const band = FRANCHISE.bands.find((b) => studentsEach <= b.upTo);
  const last = FRANCHISE.bands[FRANCHISE.bands.length - 1];
  const list = (band ? band.price : last.price + (studentsEach - last.upTo) * FRANCHISE.extraStudent) + (premiumMax ? FRANCHISE.premiumMaxAddOn : 0);
  const groupPricing = branches >= FRANCHISE.minBranches;
  const discount = groupPricing ? (FRANCHISE.discounts.find((d) => branches >= d.minBranches)?.percent ?? 0) : 0;
  const single = PLANS.find((p) => p.key === (premiumMax ? 'premium_max' : 'premium'))!;
  const perBranch = groupPricing
    ? Math.round(list * (1 - discount / 100))
    : single.price + Math.max(0, studentsEach - single.students) * single.extraStudent;
  const headOffice = branches >= 2 && branches < FRANCHISE.headOffice.freeFromBranches ? FRANCHISE.headOffice.price : 0;
  const total = perBranch * branches + headOffice;
  return { groupPricing, discount, list, perBranch, headOffice, total, perChild: branches * studentsEach ? Math.round(total / (branches * studentsEach)) : 0 };
}
