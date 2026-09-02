import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { WorkbookParserService } from './workbook-parser.service';
import { buildFixtureWorkbook } from './test-fixtures';

describe('WorkbookParserService', () => {
  let service: WorkbookParserService;

  beforeEach(() => {
    service = new WorkbookParserService();
  });

  it('parses a well-formed workbook into rows per tab', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
      Users: [
        { 'Full Name': 'Jane Doe', Email: 'jane@school.edu', Role: 'teacher' },
      ],
    });

    const result = await service.parse(buffer);

    expect(result.classes.rows).toHaveLength(1);
    expect(result.classes.rows[0].cells['Class Name']).toBe('Grade 5');
    expect(result.classes.rows[0].rowNumber).toBe(2);
    expect(result.users.rows).toHaveLength(1);
    expect(result.students.rows).toHaveLength(0);
    expect(result.feeStructures.rows).toHaveLength(0);
  });

  it('skips fully empty rows', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
        {},
        { 'Class Name': 'Grade 6', Section: 'B', 'Academic Year': '2025-26' },
      ],
    });

    const result = await service.parse(buffer);
    expect(result.classes.rows).toHaveLength(2);
  });

  it('captures unrecognized extra columns without failing', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Instructions').addRow(['Read me']);
    const classesSheet = workbook.addWorksheet('Classes');
    classesSheet.addRow([
      'Class Name',
      'Section',
      'Academic Year',
      'Class Teacher Email',
      'Notes',
    ]);
    classesSheet.addRow(['Grade 5', 'A', '2025-26', '', 'some note']);
    workbook
      .addWorksheet('Users')
      .addRow(['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)']);
    workbook
      .addWorksheet('Students')
      .addRow([
        'Student Name',
        'Admission Number',
        'Class Name',
        'Section',
        'Date of Birth',
        'Parent Name',
        'Parent Mobile Number',
        'Parent Email',
        'Blood Group',
        'Caste',
        'Parent Profession',
      ]);
    workbook
      .addWorksheet('Fee Structures')
      .addRow([
        'Class Name',
        'Section',
        'Term',
        'Fee Component',
        'Amount',
        'Due Date',
        'Late Fee',
      ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await service.parse(buffer);
    expect(result.classes.extraColumns).toEqual(['Notes']);
    expect(result.classes.rows[0].cells['Class Name']).toBe('Grade 5');
  });

  it('throws when a required tab is missing', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Instructions');
    workbook
      .addWorksheet('Classes')
      .addRow([
        'Class Name',
        'Section',
        'Academic Year',
        'Class Teacher Email',
      ]);
    workbook
      .addWorksheet('Users')
      .addRow(['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)']);
    // Students and Fee Structures tabs intentionally omitted
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    await expect(service.parse(buffer)).rejects.toThrow(BadRequestException);
  });

  it('throws when required headers are missing from a tab', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Instructions');
    workbook.addWorksheet('Classes').addRow(['Class Name', 'Academic Year']); // missing Section, Class Teacher Email
    workbook
      .addWorksheet('Users')
      .addRow(['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)']);
    workbook
      .addWorksheet('Students')
      .addRow([
        'Student Name',
        'Admission Number',
        'Class Name',
        'Section',
        'Date of Birth',
        'Parent Name',
        'Parent Mobile Number',
        'Parent Email',
        'Blood Group',
        'Caste',
        'Parent Profession',
      ]);
    workbook
      .addWorksheet('Fee Structures')
      .addRow([
        'Class Name',
        'Section',
        'Term',
        'Fee Component',
        'Amount',
        'Due Date',
        'Late Fee',
      ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    await expect(service.parse(buffer)).rejects.toThrow(BadRequestException);
  });

  it('throws when the file is not a valid workbook', async () => {
    const garbage = Buffer.from('not an xlsx file');
    await expect(service.parse(garbage)).rejects.toThrow(BadRequestException);
  });

  it('accepts required-column headers with a trailing "*" and strips it from the parsed keys', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Instructions');
    const classesSheet = workbook.addWorksheet('Classes');
    classesSheet.addRow([
      'Class Name*',
      'Section*',
      'Academic Year* ',
      'Class Teacher Email',
    ]);
    classesSheet.addRow(['Grade 5', 'A', '2025-26', '']);
    workbook
      .addWorksheet('Users')
      .addRow(['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)']);
    workbook
      .addWorksheet('Students')
      .addRow([
        'Student Name',
        'Admission Number',
        'Class Name',
        'Section',
        'Date of Birth',
        'Parent Name',
        'Parent Mobile Number',
        'Parent Email',
        'Blood Group',
        'Caste',
        'Parent Profession',
      ]);
    workbook
      .addWorksheet('Fee Structures')
      .addRow([
        'Class Name',
        'Section',
        'Term',
        'Fee Component',
        'Amount',
        'Due Date',
        'Late Fee',
      ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await service.parse(buffer);
    expect(result.classes.rows[0].cells['Class Name']).toBe('Grade 5');
    expect(result.classes.rows[0].cells['Academic Year']).toBe('2025-26');
  });

  it('reads Date-valued cells as YYYY-MM-DD strings', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Instructions');
    workbook
      .addWorksheet('Classes')
      .addRow([
        'Class Name',
        'Section',
        'Academic Year',
        'Class Teacher Email',
      ]);
    workbook
      .addWorksheet('Users')
      .addRow(['Full Name', 'Email', 'Phone Number', 'Role', 'Assigned Class (Teachers only)']);
    const studentsSheet = workbook.addWorksheet('Students');
    studentsSheet.addRow([
      'Student Name',
      'Admission Number',
      'Class Name',
      'Section',
      'Date of Birth',
      'Parent Name',
      'Parent Mobile Number',
      'Parent Email',
      'Blood Group',
      'Caste',
      'Parent Profession',
    ]);
    studentsSheet.addRow([
      'Amy',
      'A1',
      'Grade 5',
      'A',
      new Date('2015-06-01T00:00:00.000Z'),
      'Bob',
      '+919876543210',
      '',
      '',
      '',
      '',
    ]);
    workbook
      .addWorksheet('Fee Structures')
      .addRow([
        'Class Name',
        'Section',
        'Term',
        'Fee Component',
        'Amount',
        'Due Date',
        'Late Fee',
      ]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const result = await service.parse(buffer);
    expect(result.students.rows[0].cells['Date of Birth']).toBe('2015-06-01');
  });
});
