import {
  ParsedTab,
  TabValidation,
  ValidClassRow,
  ValidFeeStructureRow,
} from '../types';
import { isValidCalendarDate, issue, resolveClass } from './shared';

const TAB = 'Fee Structures' as const;

export function validateFeeStructuresTab(
  tab: ParsedTab,
  classes: ValidClassRow[],
): TabValidation<ValidFeeStructureRow> {
  const errors: TabValidation<ValidFeeStructureRow>['errors'] = [];
  const warnings: TabValidation<ValidFeeStructureRow>['warnings'] = [];
  const validRows: ValidFeeStructureRow[] = [];
  const componentsByGroup = new Map<string, Set<string>>();

  for (const row of tab.rows) {
    const className = row.cells['Class Name'];
    const section = row.cells['Section'];
    const term = row.cells['Term'];
    const feeComponent = row.cells['Fee Component'];
    const amountRaw = row.cells['Amount'];
    const dueDate = row.cells['Due Date'];
    const lateFeeRaw = row.cells['Late Fee'];

    let hasError = false;

    if (!className) {
      errors.push(issue(TAB, row.rowNumber, 'Class Name', 'is required'));
      hasError = true;
    }
    if (!term) {
      errors.push(issue(TAB, row.rowNumber, 'Term', 'is required'));
      hasError = true;
    }
    if (!feeComponent) {
      errors.push(issue(TAB, row.rowNumber, 'Fee Component', 'is required'));
      hasError = true;
    }

    let amount: number | undefined;
    if (!amountRaw) {
      errors.push(issue(TAB, row.rowNumber, 'Amount', 'is required'));
      hasError = true;
    } else {
      amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push(
          issue(TAB, row.rowNumber, 'Amount', 'must be a positive number'),
        );
        hasError = true;
      }
    }

    if (!dueDate) {
      errors.push(issue(TAB, row.rowNumber, 'Due Date', 'is required'));
      hasError = true;
    } else if (!isValidCalendarDate(dueDate)) {
      errors.push(
        issue(TAB, row.rowNumber, 'Due Date', 'must be in format YYYY-MM-DD'),
      );
      hasError = true;
    }

    let lateFee: number | undefined;
    if (lateFeeRaw) {
      lateFee = Number(lateFeeRaw);
      if (!Number.isFinite(lateFee) || lateFee < 0) {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Late Fee',
            'must be a non-negative number',
          ),
        );
        hasError = true;
      }
    }

    let classKey: string | undefined;
    if (className) {
      const resolution = resolveClass(classes, className, section);
      if (resolution.status === 'not_found') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            section
              ? `class "${className}" (Section ${section}) not found in the Classes tab`
              : `class "${className}" not found in the Classes tab`,
          ),
        );
        hasError = true;
      } else if (resolution.status === 'ambiguous') {
        errors.push(
          issue(
            TAB,
            row.rowNumber,
            'Class Name',
            `"${className}"${section ? ` (Section ${section})` : ''} matches ${resolution.count} classes — specify Section to disambiguate`,
          ),
        );
        hasError = true;
      } else {
        classKey = resolution.key;
      }
    }

    if (hasError || !classKey || amount === undefined) continue;

    const groupKey = `${classKey}|${term.trim().toLowerCase()}`;
    const seenComponents = componentsByGroup.get(groupKey) ?? new Set<string>();
    const componentKey = feeComponent.trim().toLowerCase();
    if (seenComponents.has(componentKey)) {
      errors.push(
        issue(
          TAB,
          row.rowNumber,
          'Fee Component',
          `duplicate component "${feeComponent}" already defined for this Class/Section/Term earlier in this file`,
        ),
      );
      continue;
    }
    seenComponents.add(componentKey);
    componentsByGroup.set(groupKey, seenComponents);

    validRows.push({
      row: row.rowNumber,
      classKey,
      term,
      feeComponent,
      amount,
      dueDate,
      lateFee,
    });
  }

  warnings.push(...findGroupInconsistencies(validRows));

  return { errors, warnings, validRows };
}

/**
 * dueDate and lateFee live on the FeeStructure (term), not per FeeItem/component —
 * flag when rows sharing a Class+Section+Term group disagree, since only the first
 * row's values will be used when the structure is created.
 */
function findGroupInconsistencies(rows: ValidFeeStructureRow[]) {
  const warnings: TabValidation<ValidFeeStructureRow>['warnings'] = [];
  const groups = new Map<string, ValidFeeStructureRow[]>();
  for (const row of rows) {
    const key = `${row.classKey}|${row.term.trim().toLowerCase()}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const [first, ...rest] = group;
    for (const row of rest) {
      if (row.dueDate !== first.dueDate) {
        warnings.push(
          issue(
            TAB,
            row.row,
            'Due Date',
            `differs from row ${first.row} in the same Class/Section/Term group — using ${first.dueDate}`,
          ),
        );
      }
      if ((row.lateFee ?? 0) !== (first.lateFee ?? 0)) {
        warnings.push(
          issue(
            TAB,
            row.row,
            'Late Fee',
            `differs from row ${first.row} in the same Class/Section/Term group — using ${first.lateFee ?? 0}`,
          ),
        );
      }
    }
  }

  return warnings;
}
