export interface RawRow {
  /** 1-based row number as it appears in the spreadsheet, for error reporting */
  rowNumber: number;
  cells: Record<string, string>;
}

export interface ParsedTab {
  headers: string[];
  extraColumns: string[];
  rows: RawRow[];
}

export interface ParsedWorkbook {
  classes: ParsedTab;
  users: ParsedTab;
  students: ParsedTab;
  feeStructures: ParsedTab;
}

export type ImportTabName = 'Classes' | 'Users' | 'Students' | 'Fee Structures';

export interface ImportIssue {
  tab: ImportTabName;
  row: number;
  column?: string;
  reason: string;
}

export interface TabValidation<T> {
  errors: ImportIssue[];
  warnings: ImportIssue[];
  validRows: T[];
}

export interface ValidClassRow {
  row: number;
  name: string;
  section: string;
  academicYear: string;
  classTeacherEmail?: string;
}

export interface ValidUserRow {
  row: number;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'accounts' | 'teacher';
  assignedClassName?: string;
}

export interface ValidStudentRow {
  row: number;
  name: string;
  admissionNo: string;
  classKey: string;
  dob?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
}

export interface ValidFeeStructureRow {
  row: number;
  classKey: string;
  term: string;
  feeComponent: string;
  amount: number;
  dueDate: string;
  lateFee?: number;
}

export interface TabReport {
  tab: ImportTabName;
  rowCount: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

export interface ValidationReport {
  tabs: TabReport[];
  totalErrors: number;
  totalWarnings: number;
  canImport: boolean;
}

export interface EntitySummary {
  created: number;
  updated: number;
}

export interface CreatedUserCredential {
  email: string;
  /** Plaintext, returned once — the account must reset it on first login */
  temporaryPassword: string;
}

export interface ImportSummary {
  classes: EntitySummary;
  users: EntitySummary;
  students: EntitySummary;
  feeStructures: EntitySummary;
  createdUserCredentials: CreatedUserCredential[];
}

export interface CommitResult {
  importJobId: string;
  status: 'completed' | 'pending';
  summary?: ImportSummary;
}

export interface ImportJobQueuePayload {
  importJobId: string;
  tenantId: string;
  fileBase64: string;
}

export interface ImportJobStatusResponse {
  id: string;
  status: string;
  fileName: string;
  summary: ImportSummary | null;
  errorReport: unknown;
  createdAt: Date;
  completedAt: Date | null;
}
