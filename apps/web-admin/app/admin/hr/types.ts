/** Shapes returned by /hrms/*. Money is a rupee string ("1250.00"); dates are YYYY-MM-DD. */

export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'PART_TIME' | 'DAILY_WAGE';
export type EmployeeStatus = 'ACTIVE' | 'EXITED';
export const EMPLOYMENT_TYPES: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'PART_TIME', 'DAILY_WAGE'];

export type SensitiveField = 'pan' | 'aadhaar' | 'uan' | 'esiNumber' | 'bankAccount' | 'bankIfsc' | 'bankHolder';
export const SENSITIVE_FIELDS: SensitiveField[] = ['pan', 'aadhaar', 'uan', 'esiNumber', 'bankAccount', 'bankIfsc', 'bankHolder'];

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string;
  department: string | null;
  employmentType: EmploymentType;
  joinDate: string;
  exitDate: string | null;
  exitReason: string | null;
  status: EmployeeStatus;
  userId: string | null;
  user: { id: string; name: string; role: string } | null;
  masked: Record<SensitiveField, string | null>;
  hasBankDetails: boolean;
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface StaffUser {
  id: string;
  name: string;
  phone: string | null;
  role: string;
}

export interface EmployeeDocument {
  id: string;
  label: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
}

export interface ImportResult {
  total: number;
  valid: number;
  errors: { row: number; field: string; message: string }[];
  imported: number;
  dryRun: boolean;
}

// attendance
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY';
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'];

export interface DailySheet {
  date: string;
  dayKind: 'WORKING' | 'WEEKLY_OFF' | 'HOLIDAY';
  holidayName: string | null;
  rows: {
    employeeId: string;
    employeeCode: string;
    name: string;
    designation: string;
    department: string | null;
    status: AttendanceStatus | null;
    note: string | null;
    leaveLinked: boolean;
  }[];
}

export interface MonthSummary {
  month: string;
  holidays: { date: string; name: string }[];
  weeklyOffDays: number[];
  rows: {
    employeeId: string;
    employeeCode: string;
    name: string;
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    markedHoliday: number;
    unmarked: number;
    lopDays: number;
  }[];
  totals: { weeklyOffs: number; holidays: number; days: number };
}

// leave
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export const LEAVE_STATUSES: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

export interface LeaveType {
  id: string;
  name: string;
  yearlyAllowance: number;
  carryForwardCap: number;
  isPaid: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employee: { id: string; name: string; employeeCode: string };
  leaveType: { id: string; name: string; isPaid: boolean };
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface LeaveBalanceRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  balances: {
    leaveTypeId: string;
    name: string;
    isPaid: boolean;
    yearStart: string;
    yearEnd: string;
    allowance: number;
    carriedIn: number;
    used: number;
    pending: number;
    available: number;
  }[];
}

// payroll
export type WorkingDaysRule = 'CALENDAR' | 'FIXED_30' | 'WORKING_DAYS';
export const WORKING_DAYS_RULES: WorkingDaysRule[] = ['CALENDAR', 'FIXED_30', 'WORKING_DAYS'];

export interface PtSlab {
  from: string;
  to: string | null;
  monthly: string;
  february: string | null;
}

export interface HrSettings {
  weeklyOffDays: number[];
  workingDaysRule: WorkingDaysRule;
  treatUnmarkedAsAbsent: boolean;
  leaveYearStartMonth: number;
  pfEnabled: boolean;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: string;
  esiEnabled: boolean;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: string;
  ptEnabled: boolean;
  ptSlabs: PtSlab[];
}

export interface StructureComponent {
  name: string;
  kind: 'EARNING' | 'DEDUCTION';
  calc: 'FIXED' | 'PERCENT_OF_BASIC';
  amount: string | null;
  percent: number | null;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  basic: string;
  components: StructureComponent[];
  pfApplicable: boolean;
  esiApplicable: boolean;
  ptApplicable: boolean;
  monthlyGross: string;
  createdAt: string;
}

export interface Coverage {
  employeeId: string;
  employeeCode: string;
  name: string;
  designation: string;
  current: SalaryStructure | null;
}

export type RunStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'LOCKED' | 'CANCELLED';
export const RUN_STATUSES: RunStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'LOCKED', 'CANCELLED'];

export interface RunTotals {
  employees: number;
  gross: string;
  deductions: string;
  net: string;
}

export interface PayRun {
  id: string;
  month: string;
  status: RunStatus;
  preparedBy: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  selfApproved: boolean;
  lockedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  totals: RunTotals | null;
}

export interface LineSummary {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  department: string | null;
  periodDays: number;
  lopDays: number;
  paidDays: number;
  gross: string;
  deductions: string;
  net: string;
  flags: string[];
}

export interface PayRunDetail extends PayRun {
  lines: LineSummary[];
  skipped?: { employeeId: string; name: string }[];
}

export interface LineDetail extends LineSummary {
  unmarkedDays: number;
  employerPf: string;
  employerEsi: string;
  items: {
    id: string;
    kind: 'EARNING' | 'DEDUCTION';
    source: 'STRUCTURE' | 'STATUTORY' | 'ADJUSTMENT';
    code: string | null;
    name: string;
    amount: string;
    reason: string | null;
  }[];
}
