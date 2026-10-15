import ExcelJS from 'exceljs';
import {
  ImportCleanupService,
  classKey,
  fixNameCase,
  matchHeaders,
} from './import-cleanup.service';
import { WorkbookParserService } from './workbook-parser.service';
import { REQUIRED_TABS, TAB_HEADERS } from './tab-schema';

/** A workbook a school might send: wrong tab casing, its own column names, messy values. */
async function messyWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const tab of REQUIRED_TABS) {
    if (tab === 'Students') continue;
    const ws = wb.addWorksheet(tab);
    if (tab !== 'Instructions') ws.addRow(TAB_HEADERS[tab]);
  }
  wb.getWorksheet('Classes')!.addRow(['Class 5', 'A', '2026-27', '']);

  const students = wb.addWorksheet('students list');
  const headers = TAB_HEADERS.Students.map((h) =>
    h === 'Student Name'
      ? "Kid's full name"
      : h === 'Admission Number'
        ? 'Adm. No'
        : h === 'Class Name'
          ? 'Grade'
          : h === 'Date of Birth'
            ? 'DOB'
            : h,
  );
  students.addRow(headers);
  const row = TAB_HEADERS.Students.map(() => '');
  const set = (h: string, v: string) =>
    (row[TAB_HEADERS.Students.indexOf(h)] = v);
  set('Student Name', '  AARAV   SHARMA ');
  set('Admission Number', 'A-001');
  set('Class Name', 'Std V');
  set('Section', 'A');
  set('Parent Name', 'rohit sharma');
  set('Guardian 1 Relation', 'Father');
  set('Parent Mobile Number', '9876543210');
  students.addRow(row);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function setup(aiMapping: Record<string, string | null> | null) {
  const prisma = {
    class: { findMany: jest.fn().mockResolvedValue([{ name: 'Class 5' }]) },
  };
  const ai = {
    isAvailable: jest.fn().mockResolvedValue(aiMapping !== null),
    completeJson: jest.fn().mockResolvedValue({ mapping: aiMapping ?? {} }),
  };
  return {
    ai,
    service: new ImportCleanupService(prisma as never, ai as never),
  };
}

describe('ImportCleanupService', () => {
  it('turns a messy file into one the importer accepts, listing every change', async () => {
    const { service, ai } = setup({ "Kid's full name": 'Student Name' });
    const { file, changes } = await service.fix('t1', await messyWorkbook());

    // The AI saw header names only, never a row value.
    const [[req]] = ai.completeJson.mock.calls as [[{ content: string }]];
    expect(req.content).toContain("Kid's full name");
    expect(req.content).not.toMatch(/AARAV|rohit|9876543210/i);

    const parsed = await new WorkbookParserService().parse(
      Buffer.from(file, 'base64'),
    );
    expect(parsed.students.rows[0].cells).toMatchObject({
      'Student Name': 'Aarav Sharma',
      'Admission Number': 'A-001',
      'Class Name': 'Class 5',
      'Parent Name': 'Rohit Sharma',
    });
    expect(changes).toEqual(
      expect.arrayContaining([
        { kind: 'renamed_tab', from: 'students list', to: 'Students' },
        {
          kind: 'renamed_column',
          tab: 'Students',
          from: "Kid's full name",
          to: 'Student Name',
          byAi: true,
        },
        {
          kind: 'renamed_column',
          tab: 'Students',
          from: 'Adm. No',
          to: 'Admission Number',
          byAi: false,
        },
        {
          kind: 'renamed_column',
          tab: 'Students',
          from: 'Grade',
          to: 'Class Name',
          byAi: false,
        },
        {
          kind: 'class_name',
          tab: 'Students',
          from: 'Std V',
          to: 'Class 5',
          count: 1,
        },
      ]),
    );
  });

  it('still fixes what it can without the AI', async () => {
    const { service } = setup(null);
    const { changes } = await service.fix('t1', await messyWorkbook());
    expect(changes.some((c) => c.kind === 'renamed_column' && c.byAi)).toBe(
      false,
    );
    expect(
      changes.some((c) => c.kind === 'renamed_column' && c.from === 'DOB'),
    ).toBe(true);
  });

  it('ignores AI mappings to columns that are not missing or headers that do not exist', async () => {
    const { service } = setup({
      "Kid's full name": 'Section',
      Ghost: 'Student Name',
    });
    const { changes } = await service.fix('t1', await messyWorkbook());
    expect(changes.some((c) => c.kind === 'renamed_column' && c.byAi)).toBe(
      false,
    );
  });
});

describe('cleanup helpers', () => {
  it('matches headers exactly or by known alias, each template column once', () => {
    expect(
      matchHeaders(['Name', 'Mobile No', 'Section'], TAB_HEADERS.Students),
    ).toEqual({
      Name: 'Student Name',
      'Mobile No': 'Parent Mobile Number',
    });
  });

  it('normalises class names', () => {
    for (const v of ['Class 5', 'Grade 5', 'STD V', '5th', 'class-5'])
      expect(classKey(v)).toBe('5');
    expect(classKey('L.K.G.')).toBe('lkg');
    expect(classKey('Class 10')).not.toBe(classKey('Class 1'));
  });

  it('fixes only all-caps or all-lowercase names', () => {
    expect(fixNameCase('AARAV SHARMA')).toBe('Aarav Sharma');
    expect(fixNameCase("d'souza anne-marie")).toBe("D'Souza Anne-Marie");
    expect(fixNameCase('McDonald')).toBeNull();
    expect(fixNameCase('Aarav Sharma')).toBeNull();
  });
});
