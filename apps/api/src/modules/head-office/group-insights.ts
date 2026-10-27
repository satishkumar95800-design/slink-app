/**
 * Head office insights (docs/SPEC-franchise.md §8): a health score per branch
 * and rule-based findings with their numbers. Pure and deterministic; the AI
 * brief may only rephrase these findings.
 */
import type { BranchMetrics } from './head-office.service';

export interface BranchFacts {
  id: string;
  name: string;
  metrics: BranchMetrics;
  /** Attendance % over days 31–60 ago, for the trend. */
  attendancePrev30: number | null;
  /** Fees received (receipts) in the last 30 days and the 30 before, rupees. */
  collectedLast30: number;
  collectedPrev30: number;
}

export type Band = 'good' | 'watch' | 'risk';

export interface BranchScore {
  id: string;
  name: string;
  /** 0–100, null when the branch has no numbers yet. */
  score: number | null;
  band: Band | null;
  parts: {
    attendance: number | null;
    collection: number | null;
    appUse: number | null;
    syllabus: number | null;
    compliance: number | null;
  };
}

export type FindingKind =
  | 'attendance_drop'
  | 'attendance_low'
  | 'attendance_late_today'
  | 'collection_behind'
  | 'collections_slowing'
  | 'group_dues'
  | 'admissions_weak'
  | 'app_use_low'
  | 'syllabus_late'
  | 'top_branch';

export interface Finding {
  kind: FindingKind;
  severity: Band;
  branchId: string | null;
  branch: string | null;
  values: Record<string, number>;
}

/** Weights of the score parts; a part a branch lacks is left out. */
const WEIGHTS = {
  attendance: 30,
  collection: 30,
  appUse: 20,
  syllabus: 10,
  compliance: 10,
} as const;

/** 0 at `low` or below, 100 at `high` or above, linear between. */
const scale = (v: number | null, low: number, high: number) =>
  v === null
    ? null
    : Math.round(Math.min(100, Math.max(0, ((v - low) / (high - low)) * 100)));

const round1 = (n: number) => Math.round(n * 10) / 10;

export function branchScore(b: BranchFacts): BranchScore {
  const m = b.metrics;
  const parts: BranchScore['parts'] = {
    attendance: scale(m.attendance30, 70, 95),
    collection: scale(m.fees.collectionPct, 50, 95),
    appUse: m.students > 0 ? scale(m.appUsePct, 20, 90) : null,
    syllabus: m.syllabus?.planned ? scale(m.syllabus.onTimePct, 50, 100) : null,
    compliance:
      m.compliance.classes === 0
        ? null
        : { done: 100, holiday: 100, pending: 70, late: 0 }[m.compliance.state],
  };
  let total = 0;
  let weight = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    const v = parts[k as keyof typeof parts];
    if (v === null) continue;
    total += v * w;
    weight += w;
  }
  // Only the attendance-today part is not enough to judge a branch.
  const score = weight > WEIGHTS.compliance ? Math.round(total / weight) : null;
  return {
    id: b.id,
    name: b.name,
    score,
    band:
      score === null
        ? null
        : score >= 80
          ? 'good'
          : score >= 60
            ? 'watch'
            : 'risk',
    parts,
  };
}

const conversion = (m: BranchMetrics) =>
  m.admissions && m.admissions.enquiries > 0
    ? round1((m.admissions.enrolled / m.admissions.enquiries) * 100)
    : null;

/** Findings for the group, most serious first. */
export function groupFindings(branches: BranchFacts[]): Finding[] {
  /** Each finding with how much it matters within its severity. */
  const out: { f: Finding; weight: number }[] = [];
  const add = (
    kind: FindingKind,
    severity: Band,
    b: BranchFacts | null,
    values: Record<string, number>,
    weight: number,
  ) =>
    out.push({
      f: {
        kind,
        severity,
        branchId: b?.id ?? null,
        branch: b?.name ?? null,
        values,
      },
      weight,
    });

  const collected = branches.reduce((t, b) => t + b.metrics.fees.collected, 0);
  const outstanding = branches.reduce(
    (t, b) => t + b.metrics.fees.outstanding,
    0,
  );
  const groupPct =
    collected + outstanding > 0
      ? round1((collected / (collected + outstanding)) * 100)
      : null;
  const enquiries = branches.reduce(
    (t, b) => t + (b.metrics.admissions?.enquiries ?? 0),
    0,
  );
  const enrolled = branches.reduce(
    (t, b) => t + (b.metrics.admissions?.enrolled ?? 0),
    0,
  );
  const groupConversion =
    enquiries > 0 ? round1((enrolled / enquiries) * 100) : null;

  for (const b of branches) {
    const m = b.metrics;
    if (m.compliance.state === 'late')
      add(
        'attendance_late_today',
        'risk',
        b,
        { classes: m.compliance.notMarked },
        90,
      );

    if (m.attendance30 !== null && b.attendancePrev30 !== null) {
      const drop = round1(b.attendancePrev30 - m.attendance30);
      if (drop >= 5)
        add(
          'attendance_drop',
          drop >= 10 ? 'risk' : 'watch',
          b,
          { now: m.attendance30, before: b.attendancePrev30 },
          70 + drop,
        );
      else if (m.attendance30 < 85)
        add('attendance_low', 'watch', b, { pct: m.attendance30 }, 60);
    } else if (m.attendance30 !== null && m.attendance30 < 85)
      add('attendance_low', 'watch', b, { pct: m.attendance30 }, 60);

    const pct = m.fees.collectionPct;
    if (pct !== null && groupPct !== null && groupPct - pct >= 10)
      add(
        'collection_behind',
        groupPct - pct >= 20 ? 'risk' : 'watch',
        b,
        { pct, group: groupPct, outstanding: m.fees.outstanding },
        65 + (groupPct - pct),
      );

    if (b.collectedPrev30 > 0 && b.collectedLast30 < b.collectedPrev30 * 0.7)
      add(
        'collections_slowing',
        'watch',
        b,
        { now: b.collectedLast30, before: b.collectedPrev30 },
        55,
      );

    const conv = conversion(m);
    if (
      conv !== null &&
      groupConversion !== null &&
      (m.admissions?.enquiries ?? 0) >= 10 &&
      groupConversion - conv >= 15
    )
      add(
        'admissions_weak',
        'watch',
        b,
        {
          pct: conv,
          group: groupConversion,
          enquiries: m.admissions!.enquiries,
        },
        50,
      );

    if (m.students >= 20 && m.appUsePct !== null && m.appUsePct < 50)
      add('app_use_low', 'watch', b, { pct: m.appUsePct }, 40);

    if (
      m.syllabus &&
      m.syllabus.planned > 0 &&
      m.syllabus.onTimePct !== null &&
      m.syllabus.onTimePct < 70
    )
      add(
        'syllabus_late',
        'watch',
        b,
        {
          pct: m.syllabus.onTimePct,
          late: m.syllabus.planned - m.syllabus.onTime,
        },
        45,
      );
  }

  const overdue = branches.reduce((t, b) => t + b.metrics.fees.overdueCount, 0);
  if (outstanding > 0 && overdue > 0)
    add(
      'group_dues',
      groupPct !== null && groupPct < 75 ? 'risk' : 'watch',
      null,
      { amount: outstanding, overdue, pct: groupPct ?? 0 },
      58,
    );

  const best = branches
    .map(branchScore)
    .filter((s) => s.score !== null)
    .sort((a, b) => b.score! - a.score!)[0];
  if (best && branches.length > 1 && best.score! >= 80)
    add(
      'top_branch',
      'good',
      branches.find((b) => b.id === best.id)!,
      { score: best.score! },
      0,
    );

  const rank = { risk: 0, watch: 1, good: 2 };
  return out
    .sort(
      (a, b) => rank[a.f.severity] - rank[b.f.severity] || b.weight - a.weight,
    )
    .map((x) => x.f);
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** One finding as an English sentence (the AI prompt, and the email when AI is off). */
export function findingText(f: Finding): string {
  const v = f.values;
  switch (f.kind) {
    case 'attendance_late_today':
      return `${f.branch}: attendance not marked by the cutoff today in ${v.classes} classes.`;
    case 'attendance_drop':
      return `${f.branch}: attendance fell to ${v.now}% over the last 30 days, from ${v.before}% the month before.`;
    case 'attendance_low':
      return `${f.branch}: attendance is ${v.pct}% over the last 30 days.`;
    case 'collection_behind':
      return `${f.branch}: ${v.pct}% of this year's fees collected against ${v.group}% for the group; ${inr(v.outstanding)} still due.`;
    case 'collections_slowing':
      return `${f.branch}: ${inr(v.now)} received in the last 30 days against ${inr(v.before)} in the 30 before.`;
    case 'group_dues':
      return `Across the group ${inr(v.amount)} of this year's fees is still due, with ${v.overdue} fee items overdue (${v.pct}% collected).`;
    case 'admissions_weak':
      return `${f.branch}: ${v.pct}% of ${v.enquiries} enquiries enrolled against ${v.group}% for the group.`;
    case 'app_use_low':
      return `${f.branch}: only ${v.pct}% of students have a parent on the app.`;
    case 'syllabus_late':
      return `${f.branch}: ${v.pct}% of subjects are on time with the syllabus; ${v.late} are behind.`;
    case 'top_branch':
      return `${f.branch} leads the group with a health score of ${v.score}.`;
  }
}
