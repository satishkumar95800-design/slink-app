import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService, AiUnavailableError } from '../ai/ai.service';
import { OPTIONAL_TAB_HEADERS, REQUIRED_TABS, TAB_HEADERS } from './tab-schema';

type DataTab = keyof typeof TAB_HEADERS;
const DATA_TABS = Object.keys(TAB_HEADERS) as DataTab[];

export type CleanupChange =
  | { kind: 'renamed_tab'; from: string; to: string }
  | {
      kind: 'renamed_column';
      tab: string;
      from: string;
      to: string;
      byAi: boolean;
    }
  | {
      kind: 'fixed_name_case';
      tab: string;
      column: string;
      count: number;
      example: string;
    }
  | { kind: 'trimmed_spaces'; tab: string; count: number }
  | {
      kind: 'class_name';
      tab: string;
      from: string;
      to: string;
      count: number;
    };

/** Columns holding people's names, per tab. */
const NAME_COLUMNS: Partial<Record<DataTab, string[]>> = {
  Students: ['Student Name', 'Parent Name', 'Guardian 2 Name'],
  Users: ['Full Name'],
  Teachers: ['Teacher Name'],
};

/** Columns holding a class name, per tab. */
const CLASS_COLUMNS: Partial<Record<DataTab, string[]>> = {
  Classes: ['Class Name'],
  Students: ['Class Name'],
  Teachers: ['Class Name'],
  'Fee Structures': ['Class Name'],
  Users: ['Assigned Class (Teachers only)'],
};

/** Common ways schools label template columns (compared after squash()). */
const ALIASES: Record<string, string[]> = {
  'Student Name': [
    'name',
    'studentname',
    'nameofstudent',
    'pupilname',
    'childname',
  ],
  'Admission Number': [
    'admissionno',
    'admno',
    'admissionnumber',
    'admnno',
    'regno',
    'registrationno',
    'srno',
  ],
  'Class Name': ['class', 'grade', 'std', 'standard', 'classname'],
  Section: ['sec', 'div', 'division', 'section'],
  'Date of Birth': ['dob', 'birthdate', 'dateofbirth', 'birthday'],
  'Parent Name': [
    'fathername',
    'mothername',
    'parent',
    'guardianname',
    'guardian1name',
    'parentname',
  ],
  'Parent Mobile Number': [
    'mobile',
    'phone',
    'mobileno',
    'phoneno',
    'contact',
    'contactno',
    'parentphone',
    'parentmobile',
    'fathermobile',
  ],
  'Parent Email': ['email', 'parentemail', 'emailid'],
  'Blood Group': ['bloodgroup', 'bg'],
  Gender: ['gender', 'sex'],
  'Full Name': ['name', 'fullname', 'staffname'],
  'Phone Number': ['phone', 'mobile', 'mobileno', 'phoneno', 'contact'],
  'Teacher Name': ['name', 'teacher', 'teachername'],
  'Subject Name': ['subject', 'subjectname'],
  'Academic Year': ['year', 'academicyear', 'session'],
};

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Match a file's columns to the template's: exact, then alias. Returns {from: to}. */
export function matchHeaders(
  headers: string[],
  expected: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  const taken = new Set(headers.filter((h) => expected.includes(h)));
  for (const h of headers) {
    if (expected.includes(h)) continue;
    const key = squash(h);
    const target = expected.find(
      (e) =>
        !taken.has(e) &&
        (squash(e) === key || (ALIASES[e] ?? []).includes(key)),
    );
    if (target) {
      map[h] = target;
      taken.add(target);
    }
  }
  return map;
}

const ROMAN: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
};

/** "Grade 5", "Class-5", "STD V", "5th" -> "5"; "L.K.G." -> "lkg". */
export function classKey(name: string): string {
  let s = name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  s = s.replace(/\b(class|grade|std|standard|cls|stage)\b/g, ' ');
  s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');
  s = s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w)
    .join('');
  return s;
}

/** ALL CAPS or all lowercase -> Title Case; anything mixed is left as typed. */
export function fixNameCase(name: string): string | null {
  const letters = name.replace(/[^A-Za-z]/g, '');
  if (letters.length < 2) return null;
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return null;
  const fixed = name
    .toLowerCase()
    .replace(
      /(^|[\s.'-])([a-z])/g,
      (_, sep: string, c: string) => sep + c.toUpperCase(),
    );
  return fixed === name ? null : fixed;
}

/**
 * "Fix with AI" for the bulk import (docs/SPEC-ai.md 3.3). Renames tabs and
 * columns to the template's (exact/alias first; the AI only for the rest, and
 * it sees header names only — never rows), trims spaces, fixes ALL-CAPS /
 * all-lowercase names, and matches class-name variants to the school's
 * existing classes or the file's Classes tab. Returns the fixed file and every
 * change made; the console then validates it as usual.
 */
@Injectable()
export class ImportCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async fix(
    tenantId: string,
    buffer: Buffer,
  ): Promise<{ file: string; changes: CleanupChange[] }> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException(
        'File could not be read — make sure it is a valid .xlsx file',
      );
    }
    const changes: CleanupChange[] = [];

    this.renameTabs(workbook, changes);
    for (const tab of DATA_TABS) {
      const sheet = workbook.getWorksheet(tab);
      if (sheet) await this.fixHeaders(tenantId, sheet, tab, changes);
    }
    for (const tab of DATA_TABS) {
      const sheet = workbook.getWorksheet(tab);
      if (sheet) this.fixValues(sheet, tab, changes);
    }
    await this.fixClassNames(tenantId, workbook, changes);

    const out = await workbook.xlsx.writeBuffer();
    return {
      file: Buffer.from(out).toString('base64'),
      changes,
    };
  }

  /** "students", "Student List " -> "Students". */
  private renameTabs(workbook: ExcelJS.Workbook, changes: CleanupChange[]) {
    for (const required of REQUIRED_TABS) {
      if (workbook.getWorksheet(required)) continue;
      const want = squash(required).replace(/s$/, '');
      const sheet = workbook.worksheets.find((ws) => {
        const k = squash(ws.name)
          .replace(/(list|data|sheet)$/, '')
          .replace(/s$/, '');
        return (
          k === want && !(REQUIRED_TABS as readonly string[]).includes(ws.name)
        );
      });
      if (sheet) {
        changes.push({ kind: 'renamed_tab', from: sheet.name, to: required });
        sheet.name = required;
      }
    }
  }

  private headerCells(sheet: ExcelJS.Worksheet) {
    const cells: { cell: ExcelJS.Cell; text: string }[] = [];
    sheet.getRow(1).eachCell((cell) => {
      const text = String(cell.text ?? '')
        .replace(/\*\s*$/, '')
        .trim();
      if (text) cells.push({ cell, text });
    });
    return cells;
  }

  private async fixHeaders(
    tenantId: string,
    sheet: ExcelJS.Worksheet,
    tab: DataTab,
    changes: CleanupChange[],
  ) {
    const expected = TAB_HEADERS[tab];
    const optional = OPTIONAL_TAB_HEADERS[tab] ?? [];
    const cells = this.headerCells(sheet);
    const headers = cells.map((c) => c.text);
    const mapping = matchHeaders(headers, [...expected, ...optional]);
    const byAi = new Set<string>();

    const missing = expected.filter(
      (e) => !headers.includes(e) && !Object.values(mapping).includes(e),
    );
    const unknown = headers.filter(
      (h) => !expected.includes(h) && !optional.includes(h) && !mapping[h],
    );
    if (
      missing.length &&
      unknown.length &&
      (await this.ai.isAvailable(tenantId))
    ) {
      try {
        const reply = await this.ai.completeJson<{
          mapping?: Record<string, string | null>;
        }>({
          tenantId,
          feature: 'import_cleanup',
          tier: 'fast',
          maxTokens: 400,
          system:
            'You match spreadsheet column headers from an Indian school to a template. ' +
            'Reply with one JSON object only: {"mapping": {"<file header>": "<template header>" or null}}. ' +
            'Map a header only when you are sure it holds the same data; use each template header at most once.',
          content: `Tab: ${tab}\nTemplate headers still missing: ${JSON.stringify(missing)}\nFile headers not recognised: ${JSON.stringify(unknown)}`,
        });
        for (const [from, to] of Object.entries(reply.mapping ?? {})) {
          if (
            to &&
            unknown.includes(from) &&
            missing.includes(to) &&
            !Object.values(mapping).includes(to)
          ) {
            mapping[from] = to;
            byAi.add(from);
          }
        }
      } catch (err) {
        if (!(err instanceof AiUnavailableError)) throw err;
        // Exact/alias matches still apply.
      }
    }

    for (const { cell, text } of cells) {
      const to = mapping[text];
      if (!to) continue;
      cell.value = to;
      changes.push({
        kind: 'renamed_column',
        tab,
        from: text,
        to,
        byAi: byAi.has(text),
      });
    }
  }

  private columnIndex(sheet: ExcelJS.Worksheet, header: string): number | null {
    const found = this.headerCells(sheet).find((c) => c.text === header);
    return found ? Number(found.cell.col) : null;
  }

  private fixValues(
    sheet: ExcelJS.Worksheet,
    tab: DataTab,
    changes: CleanupChange[],
  ) {
    let trimmed = 0;
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      row.eachCell((cell) => {
        if (typeof cell.value === 'string') {
          const clean = cell.value.replace(/\s+/g, ' ').trim();
          if (clean !== cell.value) {
            cell.value = clean;
            trimmed++;
          }
        }
      });
    });
    if (trimmed) changes.push({ kind: 'trimmed_spaces', tab, count: trimmed });

    for (const column of NAME_COLUMNS[tab] ?? []) {
      const col = this.columnIndex(sheet, column);
      if (!col) continue;
      let count = 0;
      let example = '';
      sheet.eachRow((row, n) => {
        if (n === 1) return;
        const cell = row.getCell(col);
        if (typeof cell.value !== 'string') return;
        const fixed = fixNameCase(cell.value);
        if (!fixed) return;
        if (!example) example = `${cell.value} → ${fixed}`;
        cell.value = fixed;
        count++;
      });
      if (count)
        changes.push({ kind: 'fixed_name_case', tab, column, count, example });
    }
  }

  /** Class-name variants -> the school's existing class or the Classes tab spelling. */
  private async fixClassNames(
    tenantId: string,
    workbook: ExcelJS.Workbook,
    changes: CleanupChange[],
  ) {
    const existing = await this.prisma.class.findMany({
      where: { tenantId },
      select: { name: true },
    });
    const canonical = new Map<string, string>();
    for (const c of existing) canonical.set(classKey(c.name), c.name);
    const classesSheet = workbook.getWorksheet('Classes');
    const classCol = classesSheet
      ? this.columnIndex(classesSheet, 'Class Name')
      : null;
    if (classesSheet && classCol) {
      classesSheet.eachRow((row, n) => {
        if (n === 1) return;
        const v = String(row.getCell(classCol).text ?? '').trim();
        const key = classKey(v);
        if (v && key && !canonical.has(key)) canonical.set(key, v);
      });
    }

    for (const tab of DATA_TABS) {
      const sheet = workbook.getWorksheet(tab);
      if (!sheet) continue;
      for (const column of CLASS_COLUMNS[tab] ?? []) {
        const col = this.columnIndex(sheet, column);
        if (!col) continue;
        const counts = new Map<string, { to: string; count: number }>();
        sheet.eachRow((row, n) => {
          if (n === 1) return;
          const cell = row.getCell(col);
          const v = String(cell.text ?? '').trim();
          const to = canonical.get(classKey(v));
          if (!v || !to || to === v) return;
          cell.value = to;
          const cur = counts.get(v) ?? { to, count: 0 };
          counts.set(v, { to, count: cur.count + 1 });
        });
        for (const [from, { to, count }] of counts) {
          changes.push({ kind: 'class_name', tab, from, to, count });
        }
      }
    }
  }
}
