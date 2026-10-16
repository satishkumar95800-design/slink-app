import type { PettyCashPayeeType } from '@prisma/client';
import type { ParsedTab } from '../types';
import {
  GROUND_STAFF_TAB,
  PAYEE_NAME_MAX,
  PAYEE_NOTES_MAX,
  VENDORS_TAB,
  type PayeeImportTabName,
} from '../payee-tab-schema';
import type {
  PayeeImportIssue,
  PayeeTabReport,
  PayeeValidationReport,
  ValidPayeeRow,
} from '../payee-import.types';
import { PHONE_REGEX, cleanName, normalizedName } from './shared';

export interface ExistingPayee {
  type: PettyCashPayeeType;
  name: string;
  phone: string | null;
  isActive: boolean;
}

const TRANSPORT_HINT = /bus|transport|van|cab|vehicle|taxi|auto/i;
const PHONE_MESSAGE = 'must be in E.164 format, e.g. +919876543210';

const norm = (v: string | null | undefined) => (v ?? '').trim();

/**
 * Same registry entry: same type and name, and the phones agree (or one side
 * has none). Two people can share a name but never a phone, so differing phones
 * mean different people. Same phone alone is only a warning (shared office line).
 */
function sameEntry(
  a: { type: string; name: string; phone?: string | null },
  b: { type: string; name: string; phone?: string | null },
): boolean {
  if (a.type !== b.type) return false;
  if (normalizedName(a.name) !== normalizedName(b.name)) return false;
  const pa = norm(a.phone);
  const pb = norm(b.phone);
  return !pa || !pb || pa === pb;
}

function joinNotes(parts: Array<[string, string]>, free: string): string {
  const segments = parts
    .filter(([, v]) => v)
    .map(([label, v]) => `${label}: ${v}`);
  if (free) segments.push(free);
  return segments.join(' | ');
}

/**
 * Validates both tabs. Errors block the import (bad/missing values, duplicates
 * within the file). Rows matching an existing payee are warnings and are skipped
 * on commit, so re-running an import is safe and never overwrites registry edits.
 */
export function validatePayeeTabs(
  groundStaff: ParsedTab,
  vendors: ParsedTab,
  existing: ExistingPayee[],
): {
  report: PayeeValidationReport;
  toCreate: ValidPayeeRow[];
  skipped: ValidPayeeRow[];
} {
  const toCreate: ValidPayeeRow[] = [];
  const skipped: ValidPayeeRow[] = [];
  const seen: ValidPayeeRow[] = [];
  const tabs: PayeeTabReport[] = [];

  const run = (tab: PayeeImportTabName, parsed: ParsedTab) => {
    const type: PettyCashPayeeType =
      tab === GROUND_STAFF_TAB ? 'GROUND_STAFF' : 'VENDOR';
    const errors: PayeeImportIssue[] = [];
    const warnings: PayeeImportIssue[] = [];
    let skippedCount = 0;
    const err = (row: number, column: string | undefined, reason: string) =>
      errors.push({ tab, row, column, reason });
    const warn = (row: number, column: string | undefined, reason: string) =>
      warnings.push({ tab, row, column, reason });

    for (const raw of parsed.rows) {
      const c = raw.cells;
      const row = raw.rowNumber;
      const nameCol = tab === GROUND_STAFF_TAB ? 'Full Name' : 'Vendor Name';
      const name = cleanName(c[nameCol]);
      const phone = norm(c['Phone Number']);
      const free = norm(c['Notes']);
      let bad = false;
      const fail = (column: string, reason: string) => {
        err(row, column, reason);
        bad = true;
      };

      if (!name) fail(nameCol, 'is required');
      else if (name.length > PAYEE_NAME_MAX)
        fail(nameCol, `must be at most ${PAYEE_NAME_MAX} characters`);

      if (tab === GROUND_STAFF_TAB && !phone)
        fail('Phone Number', 'is required for ground staff');
      else if (phone && !PHONE_REGEX.test(phone))
        fail('Phone Number', PHONE_MESSAGE);

      let notes: string;
      if (tab === GROUND_STAFF_TAB) {
        notes = joinNotes([['Role', norm(c['Role / Designation'])]], free);
      } else {
        const service = norm(c['Service Type']);
        const vehicle = norm(c['Vehicle / Route Details']);
        if (vehicle && service && !TRANSPORT_HINT.test(service))
          warn(
            row,
            'Vehicle / Route Details',
            `is usually for bus/transport vendors, but Service Type is "${service}"; it will still be saved in the notes`,
          );
        notes = joinNotes(
          [
            ['Service', service],
            ['Contact', cleanName(c['Contact Person'])],
            ['Vehicle/Route', vehicle],
          ],
          free,
        );
      }
      if (notes.length > PAYEE_NOTES_MAX)
        fail(
          'Notes',
          `the combined details are too long (${notes.length} characters, max ${PAYEE_NOTES_MAX}); shorten the text in this row`,
        );
      if (bad) continue;

      const valid: ValidPayeeRow = {
        tab,
        row,
        type,
        name,
        phone: phone || undefined,
        notes: notes || undefined,
      };

      const dupInFile = seen.find((s) => sameEntry(s, valid));
      if (dupInFile) {
        err(
          row,
          nameCol,
          `duplicate of row ${dupInFile.row} in this tab ("${name}" is already listed earlier in this file)`,
        );
        continue;
      }
      seen.push(valid);

      const dupExisting = existing.find((e) => sameEntry(e, valid));
      if (dupExisting) {
        warn(
          row,
          nameCol,
          `"${name}" is already registered${dupExisting.isActive ? '' : ' (inactive)'}; this row will be skipped`,
        );
        skippedCount++;
        skipped.push(valid);
        continue;
      }
      if (phone) {
        const samePhone =
          existing.find((e) => e.type === type && norm(e.phone) === phone) ??
          seen.find((s) => s !== valid && s.type === type && s.phone === phone);
        if (samePhone)
          warn(
            row,
            'Phone Number',
            `${phone} is already used by "${samePhone.name}"; check this is not the same person`,
          );
      }
      toCreate.push(valid);
    }

    tabs.push({
      tab,
      rowCount: parsed.rows.length,
      errors,
      warnings,
      skipped: skippedCount,
    });
  };

  run(GROUND_STAFF_TAB, groundStaff);
  run(VENDORS_TAB, vendors);

  const totalErrors = tabs.reduce((n, t) => n + t.errors.length, 0);
  const totalWarnings = tabs.reduce((n, t) => n + t.warnings.length, 0);
  return {
    report: { tabs, totalErrors, totalWarnings, canImport: totalErrors === 0 },
    toCreate,
    skipped,
  };
}
