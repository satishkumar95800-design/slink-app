export type SubscriptionStatus = 'trial' | 'active' | 'renewal_due' | 'grace' | 'expired';

export interface BranchMetrics {
  students: number;
  staff: number;
  attendanceToday: { pct: number | null; marked: number };
  attendance30: number | null;
  fees: { academicYear: string | null; collected: number; outstanding: number; collectionPct: number | null; overdueCount: number };
  noticesLast30: number;
  appUsePct: number | null;
  syllabus: { planned: number; onTime: number; onTimePct: number | null } | null;
  compliance: { state: 'holiday' | 'done' | 'pending' | 'late'; classes: number; notMarked: number };
  admissions: { enquiries: number; tours: number; registrations: number; enrolled: number; lost: number; open: number; conversionPct: number | null } | null;
}

export interface Branch {
  id: string;
  name: string;
  plan: string;
  planName: string;
  included: boolean;
  status: SubscriptionStatus;
  available: boolean;
  metrics: BranchMetrics | null;
}

export interface Overview {
  group: { id: string; name: string } | null;
  totals: {
    branches: number;
    available: number;
    students: number;
    staff: number;
    collected: number;
    outstanding: number;
    collectionPct: number | null;
    overdueCount: number;
    noticesLast30: number;
    lateAttendance: number;
    enquiries: number;
    enrolled: number;
  } | null;
  attendanceCutoff?: string;
  branches: Branch[];
}

export interface Circular {
  id: string;
  title: string;
  body: string;
  audience: 'staff' | 'staff_and_parents';
  createdAt: string;
  createdBy: string;
  branches: { tenantId: string; name: string; staffCount: number; parentCount: number }[];
}

export interface BranchDetail extends Branch {
  classes: { id: string; name: string; students: number; attendance30: number | null; collected: number; outstanding: number; collectionPct: number | null }[];
  monthlyCollection: { month: string; amount: number }[];
  attendanceTrend: { date: string; pct: number | null; marked: number }[];
}

export type Band = 'good' | 'watch' | 'risk';

export interface BranchScore {
  id: string;
  name: string;
  score: number | null;
  band: Band | null;
  parts: { attendance: number | null; collection: number | null; appUse: number | null; syllabus: number | null; compliance: number | null };
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

export interface Insights {
  group: { id: string; name: string } | null;
  scores: BranchScore[];
  findings: Finding[];
  brief: { text: string; createdAt: string } | null;
  aiAvailable: boolean;
}

export interface RoyaltyTerm {
  mode: 'percent' | 'fixed';
  percent: number | null;
  fixedAmount: string | null;
  minimumAmount: string | null;
  effectiveFrom: string;
}

export interface RoyaltySummary {
  month: string;
  branches: {
    id: string;
    name: string;
    term: RoyaltyTerm | null;
    thisMonth: { collected: string; due: string; received: string };
    outstanding: string;
    lastReceivedOn: string | null;
  }[];
  totals: { dueThisMonth: string; receivedThisMonth: string; outstanding: string };
}

export interface RoyaltyBranch {
  id: string;
  name: string;
  month: string;
  outstanding: string;
  months: { month: string; collected: string; term: RoyaltyTerm | null; due: string; received: string; balance: string }[];
  terms: (RoyaltyTerm & { id: string; createdAt: string })[];
  payments: { id: string; month: string; amount: string; receivedOn: string; reference: string | null; note: string | null; voided: boolean; voidReason: string | null }[];
}
