export type EntryType = 'TOP_UP' | 'DISBURSEMENT' | 'EXPENSE' | 'RETURN';
export type EntryStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'VOIDED';
export type PayeeType = 'VENDOR' | 'GROUND_STAFF';

export const ENTRY_TYPES: EntryType[] = ['TOP_UP', 'DISBURSEMENT', 'EXPENSE', 'RETURN'];
export const ENTRY_STATUSES: EntryStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'VOIDED'];
export const PAYEE_TYPES: PayeeType[] = ['VENDOR', 'GROUND_STAFF'];

/** Amounts are rupee strings ("1250.00") straight from the API. */
export interface Person {
  id: string;
  name: string;
}

export type Recipient =
  | { kind: 'user'; id: string; name: string; role: string }
  | { kind: 'payee'; id: string; name: string; payeeType: PayeeType };

export interface Entry {
  id: string;
  type: EntryType;
  status: EntryStatus;
  amount: string;
  date: string;
  category: Person | null;
  description: string;
  hasReceipt: boolean;
  recipient: Recipient | null;
  settlesEntryId: string | null;
  createdBy: Person;
  createdAt: string;
  reviewedBy: Person | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  voidReason: string | null;
  voidedBy: Person | null;
  voidedAt: string | null;
  /** Notes and coins moved (schools that track them). */
  denominations: CashNotes | null;
}

export interface EntryPage {
  data: Entry[];
  total: number;
  page: number;
  limit: number;
}

export interface Settings {
  approvalThreshold: string;
  monthlyBudget: string | null;
  receiptRequiredAbove: string;
  overdueDays: number;
  trackDenominations: boolean;
}

export interface Summary {
  today: string;
  balance: string;
  monthToDate: { month: string; spend: string; budget: string | null; overBudget: boolean; usedPercent: number | null };
  byCategory: { categoryId: string; name: string; spend: string; budget: string | null; overBudget: boolean }[];
  openAdvances: { count: number; outstanding: string };
  overdueAdvances: { count: number; outstanding: string };
  pendingApprovals: { count: number; total: string };
  settings: Settings;
}

export interface Category {
  id: string;
  name: string;
  monthlyBudget: string | null;
  isActive: boolean;
}

export interface Payee {
  id: string;
  type: PayeeType;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export interface Advance {
  id: string;
  date: string;
  amount: string;
  settled: string;
  outstanding: string;
  ageDays: number;
  overdue: boolean;
  description: string;
  category: Person | null;
  recipient: Recipient | null;
}

export interface Statement {
  recipient: { kind: 'user' | 'payee'; id: string; name: string; payeeType?: PayeeType; role?: string };
  totals: { disbursed: string; settled: string; outstanding: string; overdueOutstanding: string; overdueCount: number };
  advances: {
    id: string;
    date: string;
    amount: string;
    status: EntryStatus;
    description: string;
    settled: string;
    outstanding: string;
    overdue: boolean;
    settlements: { id: string; type: EntryType; amount: string; date: string; status: EntryStatus; description: string }[];
  }[];
}

export type FindingKind =
  | 'CATEGORY_TRENDING_UP'
  | 'OUTLIER_ENTRY'
  | 'REPEATED_SMALL_PURCHASES'
  | 'LATE_SETTLEMENT'
  | 'OVER_BUDGET_CATEGORY'
  | 'OVER_BUDGET_TOTAL';

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: 'info' | 'warning';
  subject: { type: string; id: string | null; name: string | null };
  params: Record<string, number | string>;
  text: string;
}

export interface ForecastLine {
  categoryId: string | null;
  name: string | null;
  expected: number;
  low: number;
  high: number;
}

export type Forecast =
  | { ready: false; monthsOfData: number; needed: number }
  | {
      ready: true;
      monthsOfData: number;
      needed: number;
      forecastMonth: string;
      history: { month: string; amount: number }[];
      total: ForecastLine;
      categories: ForecastLine[];
      seasonality: { applied: boolean; factor: number | null };
      currentBalance: number;
      suggestedTopUp: { expected: number; high: number };
      findings: Finding[];
    };

export interface Advice {
  ready: boolean;
  source?: 'ai' | 'template';
  text?: string;
}

/** Indian notes and coins in circulation, largest first (matches the API). */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

/** Rupee value ("500") -> number of notes or coins. */
export type NoteCounts = Record<string, number>;

/** Notes into the cash box and out of it for one entry. */
export interface CashNotes {
  in: NoteCounts;
  out: NoteCounts;
}

export interface CashCount {
  id: string;
  countedAt: string;
  countedBy: Person;
  counts: NoteCounts;
  total: string;
  ledgerBalance: string;
  difference: string;
  note: string | null;
}

export interface CashInHand {
  tracking: boolean;
  notes: { value: number; count: number }[];
  total: string;
  ledgerBalance: string;
  difference: string;
  untrackedEntries: number;
  lastCount: CashCount | null;
  recentCounts: CashCount[];
}

/** Total value of a set of counts, in paise. */
export function countsPaise(c: NoteCounts): number {
  return DENOMINATIONS.reduce((s, d) => s + d * 100 * (c[String(d)] ?? 0), 0);
}

/** Local calendar date as YYYY-MM-DD (the school is in one timezone; browsers on site match it). */
export function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const STATUS_VARIANT = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  VOIDED: 'gray',
} as const;

export const TYPE_VARIANT = {
  TOP_UP: 'green',
  DISBURSEMENT: 'blue',
  EXPENSE: 'orange',
  RETURN: 'purple',
} as const;
