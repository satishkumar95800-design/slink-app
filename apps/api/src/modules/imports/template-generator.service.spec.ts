import ExcelJS from 'exceljs';
import { TemplateGeneratorService } from './template-generator.service';
import { WorkbookParserService } from './workbook-parser.service';
import {
  REQUIRED_TABS,
  TAB_HEADERS,
  DISPLAY_HEADERS,
  ALLOWED_ROLES,
} from './tab-schema';

describe('TemplateGeneratorService', () => {
  let service: TemplateGeneratorService;

  beforeEach(() => {
    service = new TemplateGeneratorService();
  });

  async function generateAndReload() {
    const buffer = await service.generate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
    return workbook;
  }

  it('produces all 5 required tabs by exact name', async () => {
    const workbook = await generateAndReload();
    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    expect(sheetNames).toEqual(expect.arrayContaining([...REQUIRED_TABS]));
  });

  it('writes required columns with a trailing "*", matching the spec column-naming convention', async () => {
    const workbook = await generateAndReload();

    for (const [tabName, headers] of Object.entries(DISPLAY_HEADERS)) {
      const sheet = workbook.getWorksheet(tabName);
      expect(sheet).toBeDefined();
      const headerRow = sheet!.getRow(1).values as unknown[];
      // exceljs pads index 0; actual cell values start at index 1
      const actualHeaders = headers.map((_, idx) => String(headerRow[idx + 1]));
      expect(actualHeaders).toEqual(headers);
    }
  });

  it('round-trips through WorkbookParserService without errors despite the "*" in required headers', async () => {
    // Regression test: an earlier version wrote plain headers but told users in the
    // Instructions tab that required columns are marked with "*" — a user who added
    // the "*" by hand (to match that claim) then failed the parser's exact-match check.
    const buffer = await service.generate();
    const parser = new WorkbookParserService();

    const parsed = await parser.parse(buffer);

    expect(parsed.classes.rows).toHaveLength(1);
    expect(parsed.classes.rows[0].cells['Class Name']).toBe('Grade 5');
    expect(parsed.users.rows[0].cells['Role']).toBe('teacher');
    expect(parsed.students.rows[0].cells['Admission Number']).toBe(
      'A-2025-001',
    );
    expect(parsed.feeStructures.rows[0].cells['Fee Component']).toBe('Tuition');
  });

  it('includes one example row with non-empty realistic values on every data tab', async () => {
    const workbook = await generateAndReload();

    for (const tabName of Object.keys(TAB_HEADERS)) {
      const sheet = workbook.getWorksheet(tabName)!;
      const exampleRow = sheet.getRow(2);
      const values = (exampleRow.values as unknown[]).slice(1);
      expect(values.length).toBeGreaterThan(0);
      expect(
        values.every((v) => v !== undefined && v !== null && v !== ''),
      ).toBe(true);
    }
  });

  it('restricts the Users.Role column to a dropdown of the allowed roles', async () => {
    const workbook = await generateAndReload();
    const sheet = workbook.getWorksheet('Users')!;
    const roleColumn = TAB_HEADERS.Users.indexOf('Role') + 1;
    const validation = sheet.getCell(3, roleColumn).dataValidation;

    expect(validation?.type).toBe('list');
    expect(validation?.showErrorMessage).toBe(true);
    for (const role of ALLOWED_ROLES) {
      expect(validation?.formulae?.[0]).toContain(role);
    }
  });

  it('offers a non-blocking Fee Component dropdown that still allows free text', async () => {
    const workbook = await generateAndReload();
    const sheet = workbook.getWorksheet('Fee Structures')!;
    const componentColumn =
      TAB_HEADERS['Fee Structures'].indexOf('Fee Component') + 1;
    const validation = sheet.getCell(3, componentColumn).dataValidation;

    expect(validation?.type).toBe('list');
    // OOXML often omits a false showErrorMessage attribute entirely on write, reading back as undefined
    expect(validation?.showErrorMessage).toBeFalsy();
  });

  it('freezes the header row on every data tab', async () => {
    const workbook = await generateAndReload();
    for (const tabName of Object.keys(TAB_HEADERS)) {
      const sheet = workbook.getWorksheet(tabName)!;
      expect(sheet.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    }
  });
});
