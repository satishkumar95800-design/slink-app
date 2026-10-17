/** User-facing petty-cash errors and templates kept in one place for later translation. */
export const pettyCashStrings = {
  descriptionRequired: 'Say what the money was for',
  invalidDate: 'Not a valid calendar date',
  futureDate: 'The date cannot be in the future',
  rangeReversed: '"from" must be on or before "to"',
  entryNotFound: 'Petty cash entry not found',
  categoryNotFound: 'Category not found or inactive',
  categoryRequired: 'Choose a category for an expense',
  categoryNotAllowed: 'A category applies to expenses only',
  categoryExists: 'A category with this name already exists',
  categoryInUse: 'This category has entries; deactivate it instead of deleting',
  payeeNotFound: 'Payee not found or inactive',
  staffNotFound:
    'Recipient must be a teacher, admin or accounts user of this school',
  recipientRequired:
    'Choose who received the cash: a staff user or a registered payee',
  recipientExactlyOne: 'Choose either a staff user or a payee, not both',
  recipientNotAllowed: 'This kind of entry does not take a recipient',
  settlesRequired: 'Choose the disbursement this settles',
  settlesNotAllowed: 'Only an expense or a return can settle a disbursement',
  settlesNotFound:
    'The disbursement to settle was not found or is not approved',
  settleBeforeDisbursement:
    'A settlement cannot be dated before its disbursement',
  overSettle: 'This is more than the amount still open on the disbursement',
  insufficientFloat: 'The petty cash float cannot go below zero',
  receiptRequired:
    'A receipt is required for an expense above the receipt limit',
  receiptKeyInvalid: 'That receipt does not belong to this school',
  noReceipt: 'This entry has no receipt',
  notPending: 'Only a pending entry can be approved or rejected',
  selfApproval: 'You cannot approve your own entry',
  approverOnly: 'Only an admin can do this',
  notVoidable: 'Only a pending or approved entry can be voided',
  voidNeedsApprover:
    'Voiding an entry above the approval threshold needs an admin',
  voidNotCreator:
    'Only the person who created a pending entry, or an admin, can void it',
  hasSettlements: 'Void the settlements of this disbursement first',
  statementTarget: 'Choose either a staff user or a payee',
  payeeNotFoundAny: 'Payee not found',
  settingsInvalid: 'Setting out of range',
  duplicate: 'Already exists',
  denominationsInvalid: 'The notes and coins are not valid',
  denominationsRequired: 'Enter the notes and coins for this cash entry',
  denominationsMismatch:
    'The notes and coins do not add up to the amount of this entry',
  denominationsOff: 'Notes and coins tracking is switched off for this school',
} as const;

export const DEFAULT_CATEGORIES = [
  'Stationery',
  'Repairs & Maintenance',
  'Refreshments',
  'Transport',
  'Events',
  'Miscellaneous',
] as const;

/** CSV column headers for the ledger export. */
export const CSV_HEADERS = [
  'Date',
  'Type',
  'Status',
  'Amount (INR)',
  'Category',
  'Recipient',
  'Recipient kind',
  'Description',
  'Settles entry',
  'Receipt attached',
  'Created by',
  'Reviewed by',
  'Rejection / void reason',
  'Notes in',
  'Notes out',
] as const;

/** Template text for forecast findings (English; the console renders its own translations from kind + params). */
export const findingTemplates = {
  CATEGORY_TRENDING_UP:
    '{category} spending is rising: {recentAvg} a month recently against {earlierAvg} before ({growthPct}% more).',
  OUTLIER_ENTRY:
    'A {amount} {category} entry on {date} is {multiple} times the usual {median}. Worth checking the receipt.',
  REPEATED_SMALL_PURCHASES:
    '{category} has about {countPerMonth} small purchases a month (average {avgSize}, {totalPerMonth} in all). Buying in bulk may save money.',
  LATE_SETTLEMENT:
    '{name} settled {lateCount} of {total} advances late (more than {days} days), on average {avgDelay} days after receiving the cash.',
  OVER_BUDGET_CATEGORY:
    '{category} spent {spend} against a budget of {budget} ({period}).',
  OVER_BUDGET_TOTAL:
    'Total petty cash spend was {spend} against the monthly budget of {budget} ({period}).',
} as const;

export const advicePeriod = {
  current: 'this month so far',
  last: 'last month',
} as const;
