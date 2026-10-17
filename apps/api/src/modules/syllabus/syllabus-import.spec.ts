import ExcelJS from 'exceljs';
import {
  buildSyllabusTemplate,
  parseSyllabusWorkbook,
} from './syllabus-import';

async function workbook(rows: (string | Date | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Syllabus');
  sheet.addRow([
    'Class',
    'Section',
    'Subject',
    'Unit',
    'Topic',
    'Target date (DD/MM/YYYY)',
  ]);
  rows.forEach((r) => sheet.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('syllabus import', () => {
  it('reads the template it generates', async () => {
    const { rows, errors } = await parseSyllabusWorkbook(
      await buildSyllabusTemplate(),
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      className: 'Class 5',
      section: 'A',
      subject: 'Science',
      unit: 'Unit 1: Plants',
      title: 'Parts of a plant',
      plannedBy: '2026-06-15',
    });
  });

  it('accepts Excel dates and skips blank rows', async () => {
    const { rows } = await parseSyllabusWorkbook(
      await workbook([
        [
          'Class 6',
          null,
          'Maths',
          null,
          'Fractions',
          new Date(Date.UTC(2026, 6, 1)),
        ],
        [null, null, null, null, null, null],
      ]),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        section: null,
        unit: null,
        plannedBy: '2026-07-01',
      }),
    ]);
  });

  it('reports bad rows with their row number', async () => {
    const { rows, errors } = await parseSyllabusWorkbook(
      await workbook([
        ['Class 6', 'A', 'Maths', null, '', '01/07/2026'],
        ['Class 6', 'A', 'Maths', null, 'Decimals', '31/02/2026'],
      ]),
    );
    expect(rows).toEqual([]);
    expect(errors).toEqual([
      { row: 2, code: 'TOPIC_MISSING' },
      { row: 3, code: 'DATE_INVALID', value: '31/02/2026' },
    ]);
  });

  it('refuses a sheet without the required columns', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Syllabus').addRow(['Class', 'Topic']);
    const { errors } = await parseSyllabusWorkbook(
      Buffer.from(await wb.xlsx.writeBuffer()),
    );
    expect(errors[0]).toMatchObject({ code: 'HEADERS_MISSING' });
  });
});
