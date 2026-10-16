/**
 * Separate "Vendors & Ground Staff" template (premium: needs the `pettyCash` flag).
 * Records land in the petty-cash payee registry (PettyCashPayee), not the
 * onboarding import. Header text mirrors tab-schema.ts: TAB_* is the canonical
 * asterisk-free name, DISPLAY_* is what the template shows (required columns get "*").
 */
export const PAYEE_TEMPLATE_FILE_NAME =
  'vendors-and-ground-staff-template.xlsx';

export const GROUND_STAFF_TAB = 'Ground Staff' as const;
export const VENDORS_TAB = 'Vendors' as const;
export type PayeeImportTabName = typeof GROUND_STAFF_TAB | typeof VENDORS_TAB;

export const PAYEE_TAB_HEADERS: Record<PayeeImportTabName, string[]> = {
  'Ground Staff': ['Full Name', 'Phone Number', 'Role / Designation', 'Notes'],
  Vendors: [
    'Vendor Name',
    'Service Type',
    'Contact Person',
    'Phone Number',
    'Vehicle / Route Details',
    'Notes',
  ],
};

export const PAYEE_DISPLAY_HEADERS: Record<PayeeImportTabName, string[]> = {
  'Ground Staff': [
    'Full Name*',
    'Phone Number*',
    'Role / Designation',
    'Notes',
  ],
  Vendors: [
    'Vendor Name*',
    'Service Type',
    'Contact Person',
    'Phone Number',
    'Vehicle / Route Details',
    'Notes',
  ],
};

/** Free text is still accepted; the dropdown is a non-blocking suggestion list. */
export const VENDOR_SERVICE_TYPE_OPTIONS = [
  'Bus / Transport',
  'Stationery',
  'Maintenance',
  'Catering',
  'Cleaning',
  'Security',
  'Other',
];

export const GROUND_STAFF_ROLE_OPTIONS = [
  'Peon',
  'Gardener',
  'Cleaner',
  'Security Guard',
  'Driver',
  'Helper',
];

/** PettyCashPayee.notes has no column limit in the DB but the payee DTO caps it at 500. */
export const PAYEE_NOTES_MAX = 500;
export const PAYEE_NAME_MAX = 100;
/** Total rows across both tabs; matches the HRMS employee import cap. */
export const PAYEE_IMPORT_MAX_ROWS = 500;
