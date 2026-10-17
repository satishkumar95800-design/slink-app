export type SubscriptionStatus = 'active' | 'renewal_due' | 'grace' | 'expired';

export interface BranchMetrics {
  students: number;
  staff: number;
  attendanceToday: { pct: number | null; marked: number };
  attendance30: number | null;
  fees: { academicYear: string | null; collected: number; outstanding: number; collectionPct: number | null; overdueCount: number };
  noticesLast30: number;
  appUsePct: number | null;
  syllabus: { planned: number; onTime: number; onTimePct: number | null } | null;
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
  } | null;
  branches: Branch[];
}

export interface BranchDetail extends Branch {
  classes: { id: string; name: string; students: number; attendance30: number | null; collected: number; outstanding: number; collectionPct: number | null }[];
  monthlyCollection: { month: string; amount: number }[];
  attendanceTrend: { date: string; pct: number | null; marked: number }[];
}
