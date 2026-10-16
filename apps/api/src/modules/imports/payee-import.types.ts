import type { PettyCashPayeeType } from '@prisma/client';
import type { PayeeImportTabName } from './payee-tab-schema';

export interface PayeeImportIssue {
  tab: PayeeImportTabName;
  row: number;
  column?: string;
  reason: string;
}

export interface PayeeTabReport {
  tab: PayeeImportTabName;
  rowCount: number;
  errors: PayeeImportIssue[];
  warnings: PayeeImportIssue[];
  /** Rows that match an existing payee and will be skipped on commit */
  skipped: number;
}

/** Same shape as the onboarding ValidationReport (tabs / totals / canImport). */
export interface PayeeValidationReport {
  tabs: PayeeTabReport[];
  totalErrors: number;
  totalWarnings: number;
  canImport: boolean;
}

export interface ValidPayeeRow {
  tab: PayeeImportTabName;
  row: number;
  type: PettyCashPayeeType;
  name: string;
  phone?: string;
  notes?: string;
}

export interface PayeeImportSummary {
  groundStaff: { created: number; skipped: number };
  vendors: { created: number; skipped: number };
}

export interface PayeeCommitResult {
  status: 'completed';
  summary: PayeeImportSummary;
}
