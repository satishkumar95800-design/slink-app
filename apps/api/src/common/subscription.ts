import { SubscriptionPlan } from '@prisma/client';
import type { OptionalFeature } from './tenant-features';
import {
  ADD_ONS,
  PLANS as PRICE_LIST,
} from '../modules/public-site/pricing-plans';

/**
 * Plans, subscription periods and status (docs/SPEC-subscriptions.md).
 * Prices come from the price list (pricing-plans.ts) so the PDF, the
 * marketing site and the platform dashboard never disagree.
 */

export const PLAN_KEYS: SubscriptionPlan[] = [
  'basic',
  'premium',
  'premium_max',
];

/** Every flag a plan preset decides (the platform's optional modules). */
export const PLAN_MANAGED_FEATURES: OptionalFeature[] = [
  'timetable',
  'staffDocuments',
  'advancedReports',
  'customBranding',
  'calendar',
  'feeConcession',
  'transferCertificate',
  'pettyCash',
  'syllabus',
  'hrms',
  'aiInsights',
];

const PREMIUM: OptionalFeature[] = [
  'timetable',
  'staffDocuments',
  'advancedReports',
  'customBranding',
  'calendar',
  'feeConcession',
  'transferCertificate',
  'pettyCash',
  'syllabus',
];

export const PLAN_PRESETS: Record<SubscriptionPlan, OptionalFeature[]> = {
  basic: [],
  premium: PREMIUM,
  premium_max: [...PREMIUM, 'hrms', 'aiInsights'],
};

/** The flags a plan switches on and off, ready to merge into tenants.features. */
export function presetFlags(plan: SubscriptionPlan): Record<string, boolean> {
  return Object.fromEntries(
    PLAN_MANAGED_FEATURES.map((f) => [f, PLAN_PRESETS[plan].includes(f)]),
  );
}

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  basic: 'Basic',
  premium: 'Premium',
  premium_max: 'Premium Max',
};

export function planPricing(plan: SubscriptionPlan) {
  const p = PRICE_LIST[PLAN_KEYS.indexOf(plan)];
  return { price: p.price, students: p.students, extraStudent: p.extraStudent };
}

/** Paid add-ons by flag (only on a plan that does not include them). */
const ADD_ON_PRICE: Partial<Record<OptionalFeature, number>> = {
  hrms: ADD_ONS[0][1],
  aiInsights: ADD_ONS[1][1],
};

/** Flags switched on beyond the plan's preset. */
export function addOnsOf(
  plan: SubscriptionPlan,
  features: Record<string, unknown>,
): OptionalFeature[] {
  return PLAN_MANAGED_FEATURES.filter(
    (f) => features[f] === true && !PLAN_PRESETS[plan].includes(f),
  );
}

/** Yearly amount at renewal: plan + priced add-ons + students over the allowance. */
export function yearlyAmount(
  plan: SubscriptionPlan,
  features: Record<string, unknown>,
  students: number,
) {
  const pricing = planPricing(plan);
  const addOns = addOnsOf(plan, features).reduce(
    (sum, f) => sum + (ADD_ON_PRICE[f] ?? 0),
    0,
  );
  const extraStudents = Math.max(0, students - pricing.students);
  return {
    plan: pricing.price,
    addOns,
    extraStudents,
    extraStudentsAmount: extraStudents * pricing.extraStudent,
    total: pricing.price + addOns + extraStudents * pricing.extraStudent,
  };
}

// ── periods and status ─────────────────────────────────────────────────────

export const RENEWAL_WINDOW_DAYS = 30;
export const GRACE_DAYS = 7;

const ymdToUtc = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const utcToYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(ymd: string, days: number): string {
  return utcToYmd(ymdToUtc(ymd) + days * 86_400_000);
}

/**
 * A one-year period starting on `startsOn`, ending the day before the same
 * date next year: 17/10/2026 → 16/10/2027, 01/03/2027 → 29/02/2028. A period
 * starting on 29 February ends on 28 February.
 */
export function oneYearFrom(startsOn: string): string {
  const [y, m, d] = startsOn.split('-').map(Number);
  if (m === 2 && d === 29) return `${y + 1}-02-28`;
  return addDays(
    `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    -1,
  );
}

export function daysFromTo(from: string, to: string): number {
  return Math.round((ymdToUtc(to) - ymdToUtc(from)) / 86_400_000);
}

export type SubscriptionStatus = 'active' | 'renewal_due' | 'grace' | 'expired';

export interface SubscriptionState {
  status: SubscriptionStatus;
  /** Days from today to the end date (negative once it has passed). */
  daysLeft: number;
  /** In grace: days left before the school is switched off. */
  graceDaysLeft: number | null;
}

export function subscriptionState(
  endsOn: string,
  today: string,
): SubscriptionState {
  const daysLeft = daysFromTo(today, endsOn);
  if (daysLeft > RENEWAL_WINDOW_DAYS)
    return { status: 'active', daysLeft, graceDaysLeft: null };
  if (daysLeft >= 0)
    return { status: 'renewal_due', daysLeft, graceDaysLeft: null };
  if (-daysLeft <= GRACE_DAYS)
    return { status: 'grace', daysLeft, graceDaysLeft: GRACE_DAYS + daysLeft };
  return { status: 'expired', daysLeft, graceDaysLeft: null };
}

/**
 * The period a renewal starts: the day after the current end, or today when
 * the school has been switched off (past the grace period) for a while.
 */
export function nextPeriodStart(currentEndsOn: string, today: string): string {
  const next = addDays(currentEndsOn, 1);
  return subscriptionState(currentEndsOn, today).status === 'expired'
    ? today
    : next;
}
