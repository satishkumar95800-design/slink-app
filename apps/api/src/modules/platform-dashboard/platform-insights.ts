import type { SubscriptionPlan } from '@prisma/client';
import {
  PLAN_LABEL,
  PLAN_PRESETS,
  SubscriptionStatus,
  planPricing,
} from '../../common/subscription';

/**
 * Platform dashboard numbers and suggestions (docs/SPEC-subscriptions.md 5.5).
 * Pure rules over per-school facts, so each one is testable; no AI.
 */

export interface SchoolFacts {
  id: string;
  name: string;
  isActive: boolean;
  /** Days since the school was created. */
  ageDays: number;
  plan: SubscriptionPlan;
  features: Record<string, unknown>;
  status: SubscriptionStatus;
  /** On a free trial (still running, or ended without a renewal). */
  onTrial?: boolean;
  daysLeft: number;
  yearlyTotal: number;
  addOns: string[];
  students: number;
  staff: number;
  /** Students with at least one parent signed in to the app. */
  studentsWithAppParent: number;
  /** Attendance rows marked in the last 7 days. */
  attendanceLast7: number;
}

export type SuggestionKind =
  | 'renew_soon'
  | 'trials'
  | 'switched_off'
  | 'extra_students'
  | 'upgrade_premium'
  | 'upgrade_premium_max'
  | 'low_app_use'
  | 'no_attendance'
  | 'not_set_up'
  | 'follow_up_leads';

export interface Suggestion {
  kind: SuggestionKind;
  tone: 'danger' | 'warning' | 'opportunity' | 'info';
  title: string;
  detail: string;
  /** Rupees at stake, when there is a number to it. */
  amount: number | null;
  schools: { id: string; name: string; value: string }[];
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export const LOW_APP_USE = 0.4;
const MIN_STUDENTS_FOR_APP_RULE = 20;
const SETUP_DAYS = 14;

export function buildDashboard(
  schools: SchoolFacts[],
  leads: { last7: number; last30: number },
  /** Yearly head office fees of school groups (docs/SPEC-franchise.md §5). */
  headOfficeFees = 0,
) {
  const live = schools.filter((s) => s.isActive);
  // A trial pays nothing yet: no revenue, nothing overdue.
  const billable = live.filter((s) => s.status !== 'expired' && !s.onTrial);
  const paying = live.filter((s) => !s.onTrial);
  const byPlan = { basic: 0, premium: 0, premium_max: 0 } as Record<
    SubscriptionPlan,
    number
  >;
  const revenueByPlan = { basic: 0, premium: 0, premium_max: 0 } as Record<
    SubscriptionPlan,
    number
  >;
  const byStatus: Record<SubscriptionStatus, number> = {
    trial: 0,
    active: 0,
    renewal_due: 0,
    grace: 0,
    expired: 0,
  };
  for (const s of live) {
    byPlan[s.plan]++;
    byStatus[s.status]++;
  }
  for (const s of billable) revenueByPlan[s.plan] += s.yearlyTotal;
  const sum = (list: SchoolFacts[]) =>
    list.reduce((t, s) => t + s.yearlyTotal, 0);

  const totals = {
    schools: schools.length,
    active: live.length,
    inactive: schools.length - live.length,
    students: live.reduce((t, s) => t + s.students, 0),
    staff: live.reduce((t, s) => t + s.staff, 0),
    byPlan,
    byStatus,
  };
  const revenue = {
    contracted: sum(billable) + headOfficeFees,
    headOfficeFees,
    byPlan: revenueByPlan,
    dueIn30: sum(paying.filter((s) => s.daysLeft >= 0 && s.daysLeft <= 30)),
    dueIn90: sum(paying.filter((s) => s.daysLeft >= 0 && s.daysLeft <= 90)),
    overdue: sum(
      paying.filter((s) => s.status === 'grace' || s.status === 'expired'),
    ),
  };

  const suggestions: Suggestion[] = [];
  const add = (s: Suggestion) => s.schools.length && suggestions.push(s);

  const due = live
    .filter((s) => s.status === 'renewal_due' || s.status === 'grace')
    .sort((a, b) => a.daysLeft - b.daysLeft);
  add({
    kind: 'renew_soon',
    tone: 'warning',
    title: 'Renew soon',
    detail:
      'Subscriptions ending within 30 days or in their 7-day grace period.',
    amount: sum(due),
    schools: due.map((s) => ({
      id: s.id,
      name: s.name,
      value:
        s.daysLeft >= 0
          ? `${s.daysLeft} days left · ${inr(s.yearlyTotal)}`
          : `${-s.daysLeft} days over · ${inr(s.yearlyTotal)}`,
    })),
  });

  const trials = live
    .filter((s) => s.onTrial)
    .sort((a, b) => a.daysLeft - b.daysLeft);
  add({
    kind: 'trials',
    tone: 'opportunity',
    title: 'Free trials',
    detail:
      'Schools on the 14-day trial. Call them before it ends; marking one renewed starts its paid year.',
    amount: sum(trials),
    schools: trials.map((s) => ({
      id: s.id,
      name: s.name,
      value:
        s.daysLeft >= 0
          ? `${s.daysLeft} days left · ${inr(s.yearlyTotal)}`
          : `Ended ${-s.daysLeft} days ago · ${inr(s.yearlyTotal)}`,
    })),
  });

  const off = paying.filter((s) => s.status === 'expired');
  add({
    kind: 'switched_off',
    tone: 'danger',
    title: 'Switched off for non-renewal',
    detail:
      'Staff and parents cannot sign in. Call the school; marking it renewed switches it back on.',
    amount: sum(off),
    schools: off.map((s) => ({
      id: s.id,
      name: s.name,
      value: `${-s.daysLeft} days over`,
    })),
  });

  const extra = billable
    .map((s) => {
      const p = planPricing(s.plan);
      const over = s.students - p.students;
      return { s, over, amount: over * p.extraStudent };
    })
    .filter((x) => x.over > 0)
    .sort((a, b) => b.amount - a.amount);
  add({
    kind: 'extra_students',
    tone: 'opportunity',
    title: 'Charge extra students',
    detail:
      'More students than the plan includes; add the extra-student charge at renewal.',
    amount: extra.reduce((t, x) => t + x.amount, 0),
    schools: extra.map((x) => ({
      id: x.s.id,
      name: x.s.name,
      value: `${x.over} over · ${inr(x.amount)}`,
    })),
  });

  const premiumModules = PLAN_PRESETS.premium;
  const toPremium = billable.filter(
    (s) =>
      s.plan === 'basic' &&
      (s.students > planPricing('basic').students ||
        premiumModules.filter((f) => s.features[f] === true).length >= 2),
  );
  add({
    kind: 'upgrade_premium',
    tone: 'opportunity',
    title: 'Offer Premium',
    detail:
      'Basic schools above 400 students or already using Premium modules.',
    amount:
      toPremium.length *
      (planPricing('premium').price - planPricing('basic').price),
    schools: toPremium.map((s) => ({
      id: s.id,
      name: s.name,
      value:
        s.students > planPricing('basic').students
          ? `${s.students} students`
          : `${s.addOns.length} Premium modules on`,
    })),
  });

  const toMax = billable.filter(
    (s) =>
      s.plan === 'premium' &&
      ((s.features.hrms === true && s.features.aiInsights === true) ||
        s.students > planPricing('premium').students),
  );
  add({
    kind: 'upgrade_premium_max',
    tone: 'opportunity',
    title: `Offer ${PLAN_LABEL.premium_max}`,
    detail:
      'Premium schools with both HR and AI add-ons (cheaper as Premium Max) or above 1,000 students.',
    amount:
      toMax.length *
      (planPricing('premium_max').price - planPricing('premium').price),
    schools: toMax.map((s) => ({
      id: s.id,
      name: s.name,
      value:
        s.students > planPricing('premium').students
          ? `${s.students} students`
          : 'HR + AI add-ons',
    })),
  });

  const lowApp = billable
    .filter(
      (s) =>
        s.students >= MIN_STUDENTS_FOR_APP_RULE &&
        s.studentsWithAppParent / s.students < LOW_APP_USE,
    )
    .sort(
      (a, b) =>
        a.studentsWithAppParent / a.students -
        b.studentsWithAppParent / b.students,
    );
  add({
    kind: 'low_app_use',
    tone: 'warning',
    title: 'Low parent app use',
    detail: `Fewer than ${pct(LOW_APP_USE)} of students have a parent signed in to the app. A school that doesn't use it is unlikely to renew; offer a parent onboarding drive.`,
    amount: null,
    schools: lowApp.map((s) => ({
      id: s.id,
      name: s.name,
      value: pct(s.studentsWithAppParent / s.students),
    })),
  });

  const noAttendance = billable.filter(
    (s) => s.students > 0 && s.ageDays > SETUP_DAYS && s.attendanceLast7 === 0,
  );
  add({
    kind: 'no_attendance',
    tone: 'warning',
    title: 'Not marking attendance',
    detail:
      'No attendance marked in the last 7 days. Check in with the school admin.',
    amount: null,
    schools: noAttendance.map((s) => ({
      id: s.id,
      name: s.name,
      value: `${s.students} students`,
    })),
  });

  const notSetUp = live.filter(
    (s) => s.students === 0 && s.ageDays > SETUP_DAYS,
  );
  add({
    kind: 'not_set_up',
    tone: 'info',
    title: 'Not set up yet',
    detail: `Created more than ${SETUP_DAYS} days ago with no students. Offer the data import.`,
    amount: null,
    schools: notSetUp.map((s) => ({
      id: s.id,
      name: s.name,
      value: `${s.ageDays} days`,
    })),
  });

  if (leads.last7 > 0)
    suggestions.push({
      kind: 'follow_up_leads',
      tone: 'info',
      title: 'Follow up new leads',
      detail: `${leads.last7} demo or price-list request${leads.last7 === 1 ? '' : 's'} in the last 7 days.`,
      amount: null,
      schools: [],
    });

  const toneRank = { danger: 0, warning: 1, opportunity: 2, info: 3 };
  suggestions.sort(
    (a, b) =>
      (b.amount ?? 0) - (a.amount ?? 0) || toneRank[a.tone] - toneRank[b.tone],
  );

  return { totals, revenue, leads, suggestions };
}
