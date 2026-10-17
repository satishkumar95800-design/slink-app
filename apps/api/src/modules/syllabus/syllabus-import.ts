import ExcelJS from 'exceljs';
import { isValidYmd } from '../attendance/attendance-dates';

/** One topic row from the upload, before class and subject are looked up. */
export interface ImportRow {
  /** Spreadsheet row number, for error messages. */
  row: number;
  className: string;
  section: string | null;
  subject: string;
  unit: string | null;
  title: string;
  /** YYYY-MM-DD */
  plannedBy: string;
}

/** A row problem; the console translates `code` (syllabus.importError.*). */
export interface ImportError {
  row: number;
  code: string;
  value?: string;
}

export const MAX_IMPORT_ROWS = 3000;

const HEADERS = ['Class', 'Section', 'Subject', 'Unit', 'Topic', 'Target date'];
const SHEET = 'Syllabus';

const text = (cell: ExcelJS.Cell): string => {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && 'richText' in v)
    return v.richText
      .map((r) => r.text)
      .join('')
      .trim();
  const plain = (x: unknown) =>
    typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
      ? String(x).trim()
      : '';
  if (typeof v === 'object' && 'result' in v) return plain(v.result);
  if (typeof v === 'object' && 'text' in v) return plain(v.text);
  return plain(v);
};

/** A date cell (Excel date or DD/MM/YYYY text) as YYYY-MM-DD, or null. */
function dateOf(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  const formulaResult =
    v && typeof v === 'object' && 'result' in v ? v.result : undefined;
  const d =
    v instanceof Date
      ? v
      : formulaResult instanceof Date
        ? formulaResult
        : null;
  if (d) {
    // Excel stores dates as UTC midnight.
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return isValidYmd(ymd) ? ymd : null;
  }
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text(cell));
  if (!m) return null;
  const ymd = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isValidYmd(ymd) ? ymd : null;
}

/** Reads the "Syllabus" sheet (or the first sheet). Blank rows are skipped. */
export async function parseSyllabusWorkbook(
  buffer: Buffer,
): Promise<{ rows: ImportRow[]; errors: ImportError[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: [{ row: 0, code: 'FILE_UNREADABLE' }] };
  }
  const sheet = workbook.getWorksheet(SHEET) ?? workbook.worksheets[0];
  if (!sheet)
    return { rows: [], errors: [{ row: 0, code: 'FILE_UNREADABLE' }] };

  const col = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, n) => {
    col.set(
      text(cell)
        .toLowerCase()
        .replace(/\s*\(.*\)$/, ''),
      n,
    );
  });
  const missing = HEADERS.filter(
    (h) => h !== 'Section' && h !== 'Unit' && !col.has(h.toLowerCase()),
  );
  if (missing.length)
    return {
      rows: [],
      errors: [{ row: 1, code: 'HEADERS_MISSING', value: missing.join(', ') }],
    };
  const at = (row: ExcelJS.Row, header: string) =>
    col.has(header.toLowerCase())
      ? row.getCell(col.get(header.toLowerCase())!)
      : null;

  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const values = HEADERS.map((h) => {
      const c = at(row, h);
      return c ? text(c) : '';
    });
    if (values.every((v) => !v)) continue;
    if (rows.length + errors.length >= MAX_IMPORT_ROWS) {
      errors.push({
        row: n,
        code: 'TOO_MANY_ROWS',
        value: String(MAX_IMPORT_ROWS),
      });
      break;
    }
    const [className, section, subject, unit, title] = values;
    const dateCell = at(row, 'Target date')!;
    const plannedBy = dateOf(dateCell);
    let ok = true;
    const bad = (code: string, value?: string) => {
      ok = false;
      errors.push({ row: n, code, ...(value !== undefined && { value }) });
    };
    if (!className) bad('CLASS_MISSING');
    if (!subject) bad('SUBJECT_MISSING');
    if (!title) bad('TOPIC_MISSING');
    else if (title.length > 200) bad('TOPIC_TOO_LONG');
    if (!plannedBy) bad('DATE_INVALID', text(dateCell));
    if (ok)
      rows.push({
        row: n,
        className,
        section: section || null,
        subject,
        unit: unit ? unit.slice(0, 100) : null,
        title,
        plannedBy: plannedBy!,
      });
  }
  return { rows, errors };
}

/** Blank template with one example row and short instructions. */
export async function buildSyllabusTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET);
  sheet.columns = [
    { header: 'Class', key: 'class', width: 12 },
    { header: 'Section', key: 'section', width: 10 },
    { header: 'Subject', key: 'subject', width: 18 },
    { header: 'Unit', key: 'unit', width: 28 },
    { header: 'Topic', key: 'topic', width: 40 },
    { header: 'Target date (DD/MM/YYYY)', key: 'date', width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    'Class 5',
    'A',
    'Science',
    'Unit 1: Plants',
    'Parts of a plant',
    '15/06/2026',
  ]);
  sheet.addRow([
    'Class 5',
    'A',
    'Science',
    'Unit 1: Plants',
    'Photosynthesis',
    '30/06/2026',
  ]);
  for (const n of [2, 3])
    sheet.getRow(n).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF7E6' },
    };
  sheet.getColumn(6).numFmt = '@';

  const help = workbook.addWorksheet('How to fill');
  help.getColumn(1).width = 100;
  [
    'One row per topic, in the order it will be taught.',
    'Class and Section must match the class names in Schoolinkd exactly (e.g. "Class 5" and "A").',
    'Subject must match a subject already added for the school.',
    'Unit is optional: the chapter or unit the topic belongs to.',
    'Target date is the day the topic should be finished by, as DD/MM/YYYY.',
    'Replace the two example rows (shaded) with your own.',
  ].forEach((line) => help.addRow([line]));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
