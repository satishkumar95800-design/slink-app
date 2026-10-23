import ExcelJS from 'exceljs';

/**
 * Excel import of the book catalogue: one row per title with its copies,
 * given as accession numbers or a number of copies to number automatically.
 * Reading and row checks only; the catalogue lookups are in the service.
 */

export interface BookRow {
  /** Spreadsheet row number, for error messages. */
  row: number;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  category: string | null;
  language: string | null;
  shelf: string | null;
  /** Given accession numbers (then `copies` is their count). */
  accessionNos: string[];
  copies: number;
}

/** A row problem; the console translates `code` (library.importError.*). */
export interface ImportError {
  row: number;
  code: string;
  value?: string;
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_COPIES_PER_ROW = 200;

const SHEET = 'Books';

/** Header, the field it fills, and its longest value (as in BookInputDto). */
const COLUMNS = [
  { header: 'Title', key: 'title', max: 200 },
  { header: 'Author', key: 'author', max: 120 },
  { header: 'Publisher', key: 'publisher', max: 120 },
  { header: 'ISBN', key: 'isbn', max: 20 },
  { header: 'Category', key: 'category', max: 60 },
  { header: 'Language', key: 'language', max: 40 },
  { header: 'Shelf', key: 'shelf', max: 40 },
  { header: 'Copies', key: 'copies', max: 10 },
  { header: 'Accession numbers', key: 'accession', max: 10_000 },
] as const;

type Key = (typeof COLUMNS)[number]['key'];

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

/** "101, 102; 103" or one per line. */
export const splitAccession = (value: string): string[] =>
  value
    .split(/[,;\n]+/)
    .map((a) => a.trim())
    .filter(Boolean);

/** Reads the "Books" sheet (or the first sheet). Blank rows are skipped. */
export async function parseBooksWorkbook(
  buffer: Buffer,
): Promise<{ rows: BookRow[]; errors: ImportError[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: [{ row: 0, code: 'FILE_UNREADABLE' }] };
  }
  const sheet = workbook.getWorksheet(SHEET) ?? workbook.worksheets[0];
  if (!sheet)
    return { rows: [], errors: [{ row: 0, code: 'FILE_UNREADABLE' }] };

  // Header text, ignoring case and anything in brackets ("Copies (number)").
  const col = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, n) => {
    col.set(
      text(cell)
        .toLowerCase()
        .replace(/\s*\(.*\)$/, ''),
      n,
    );
  });
  if (!col.has('title'))
    return {
      rows: [],
      errors: [{ row: 1, code: 'HEADERS_MISSING', value: 'Title' }],
    };

  const rows: BookRow[] = [];
  const errors: ImportError[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const v = {} as Record<Key, string>;
    for (const c of COLUMNS) {
      const at = col.get(c.header.toLowerCase());
      v[c.key] = at ? text(row.getCell(at)) : '';
    }
    if (Object.values(v).every((x) => !x)) continue;
    if (rows.length + errors.length >= MAX_IMPORT_ROWS) {
      errors.push({
        row: n,
        code: 'TOO_MANY_ROWS',
        value: String(MAX_IMPORT_ROWS),
      });
      break;
    }

    let ok = true;
    const bad = (code: string, value?: string) => {
      ok = false;
      errors.push({ row: n, code, ...(value !== undefined && { value }) });
    };
    if (!v.title) bad('TITLE_MISSING');
    for (const c of COLUMNS)
      if (c.key !== 'accession' && v[c.key].length > c.max)
        bad('TOO_LONG', c.header);

    const accessionNos = splitAccession(v.accession);
    for (const a of accessionNos)
      if (a.length > 30) bad('ACCESSION_TOO_LONG', a);
    const repeated = accessionNos.filter(
      (a, i) => accessionNos.indexOf(a) !== i,
    );
    if (repeated.length) bad('ACCESSION_REPEATED', repeated[0]);

    // Copies: blank means one copy, or as many as the accession numbers given.
    let copies = accessionNos.length || 1;
    if (v.copies) {
      const c = Number(v.copies);
      if (!Number.isInteger(c) || c < 1 || c > MAX_COPIES_PER_ROW)
        bad('COPIES_INVALID', v.copies);
      else if (accessionNos.length && c !== accessionNos.length)
        bad('COPIES_MISMATCH', `${c}/${accessionNos.length}`);
      else copies = c;
    }
    if (accessionNos.length > MAX_COPIES_PER_ROW)
      bad('COPIES_INVALID', String(accessionNos.length));

    if (ok)
      rows.push({
        row: n,
        title: v.title,
        author: v.author || null,
        publisher: v.publisher || null,
        isbn: v.isbn ? v.isbn.replace(/[\s-]/g, '') : null,
        category: v.category || null,
        language: v.language || null,
        shelf: v.shelf || null,
        accessionNos,
        copies,
      });
  }
  return { rows, errors };
}

/**
 * Which existing book a row adds copies to: the same ISBN, or without one the
 * same title and author (ignoring case and spacing).
 */
export function bookKey(b: {
  title: string;
  author: string | null;
  isbn: string | null;
}): string {
  if (b.isbn) return `isbn:${b.isbn.replace(/[\s-]/g, '').toLowerCase()}`;
  const norm = (s: string | null) =>
    (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `title:${norm(b.title)}|${norm(b.author)}`;
}

/** Blank template with two example rows and short instructions. */
export async function buildBooksTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET);
  sheet.columns = [
    { header: 'Title', key: 'title', width: 36 },
    { header: 'Author', key: 'author', width: 24 },
    { header: 'Publisher', key: 'publisher', width: 20 },
    { header: 'ISBN', key: 'isbn', width: 16 },
    { header: 'Category', key: 'category', width: 16 },
    { header: 'Language', key: 'language', width: 12 },
    { header: 'Shelf', key: 'shelf', width: 10 },
    { header: 'Copies', key: 'copies', width: 10 },
    { header: 'Accession numbers', key: 'accession', width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.addRow([
    'The Jungle Book',
    'Rudyard Kipling',
    'Penguin',
    '9780141325293',
    'Fiction',
    'English',
    'A2',
    3,
    '',
  ]);
  sheet.addRow([
    'Panchatantra Kathegalu',
    '',
    'Navakarnataka',
    '',
    'Stories',
    'Kannada',
    'K1',
    '',
    '1201, 1202',
  ]);
  for (const n of [2, 3])
    sheet.getRow(n).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF7E6' },
    };
  // Keep ISBNs and accession numbers as typed (no 9.78E+12).
  sheet.getColumn(4).numFmt = '@';
  sheet.getColumn(9).numFmt = '@';

  const help = workbook.addWorksheet('How to fill');
  help.getColumn(1).width = 110;
  [
    'One row per book title. Only Title is required.',
    'Copies: how many copies the library has. They get the next free accession numbers automatically.',
    'Accession numbers: if your copies already have numbers, list them separated by commas (e.g. 1201, 1202). Then Copies can be left blank.',
    'A book already in the catalogue (same ISBN, or same title and author) gets the new copies added to it instead of a second entry.',
    'Replace the two example rows (shaded) with your own. Up to 5,000 rows per file.',
  ].forEach((line) => help.addRow([line]));

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
