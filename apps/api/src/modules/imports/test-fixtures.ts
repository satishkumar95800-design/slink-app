import ExcelJS from 'exceljs';

export interface FixtureTabs {
  Classes?: Array<Record<string, string | number>>;
  Users?: Array<Record<string, string | number>>;
  Students?: Array<Record<string, string | number>>;
  'Fee Structures'?: Array<Record<string, string | number>>;
  Instructions?: string;
}

const DEFAULT_HEADERS: Record<string, string[]> = {
  Classes: ['Class Name', 'Section', 'Academic Year', 'Class Teacher Email'],
  Users: ['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)'],
  Students: [
    'Student Name',
    'Admission Number',
    'Class Name',
    'Section',
    'Date of Birth',
    'Parent Name',
    'Parent Mobile Number',
    'Parent Email',
  ],
  'Fee Structures': [
    'Class Name',
    'Section',
    'Term',
    'Fee Component',
    'Amount',
    'Due Date',
    'Late Fee',
  ],
};

/** Builds a minimal-but-complete onboarding workbook buffer for tests, all tabs present by default. */
export async function buildFixtureWorkbook(
  overrides: FixtureTabs = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow([overrides.Instructions ?? 'Fill in the tabs below.']);

  for (const tabName of [
    'Classes',
    'Users',
    'Students',
    'Fee Structures',
  ] as const) {
    const headers = DEFAULT_HEADERS[tabName];
    const sheet = workbook.addWorksheet(tabName);
    sheet.addRow(headers);
    const rows = overrides[tabName] ?? [];
    for (const row of rows) {
      sheet.addRow(headers.map((header) => row[header] ?? ''));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
