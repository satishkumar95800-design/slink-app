import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ALLOWED_ROLES,
  BLOOD_GROUP_TEMPLATE_OPTIONS,
  CASTE_TEMPLATE_OPTIONS,
  COMMON_FEE_COMPONENTS,
  DISPLAY_HEADERS,
  TAB_HEADERS,
} from './tab-schema';

const EXAMPLE_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};

const VALIDATION_ROW_COUNT = 500;

@Injectable()
export class TemplateGeneratorService {
  async generate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'School Connect';

    this.buildInstructionsTab(workbook);
    this.buildClassesTab(workbook);
    this.buildUsersTab(workbook);
    this.buildStudentsTab(workbook);
    this.buildFeeStructuresTab(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private buildInstructionsTab(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('Instructions');
    sheet.columns = [{ width: 100 }];

    const lines = [
      'School Connect — Bulk Onboarding Template',
      '',
      'Fill order (Students and Fee Structures reference Classes; Users reference Classes for Assigned Class):',
      '  1. Classes',
      '  2. Users',
      '  3. Students',
      '  4. Fee Structures',
      '',
      'Each data tab has one highlighted example row with realistic sample values.',
      'Delete the highlighted row before importing — it is not a real record.',
      '',
      'Required columns are marked with * in the header. Do not rename, retype, or remove any columns',
      '(the * is part of the exact header text the importer matches on).',
      '',
      'Once this file is filled in, upload it on the Import Data screen and click Validate.',
      'Validation checks every row without saving anything, and lists any errors by',
      'tab, row, and column so you can fix them before importing.',
    ];

    lines.forEach((line, idx) => {
      const cell = sheet.getCell(idx + 1, 1);
      cell.value = line;
      if (idx === 0) cell.font = { bold: true, size: 14 };
    });
  }

  private buildClassesTab(workbook: ExcelJS.Workbook) {
    const sheet = this.addDataSheet(
      workbook,
      'Classes',
      DISPLAY_HEADERS.Classes,
    );
    this.addExampleRow(sheet, [
      'Grade 5',
      'A',
      '2025-26',
      'jane.doe@example-school.edu',
    ]);
  }

  private buildUsersTab(workbook: ExcelJS.Workbook) {
    const sheet = this.addDataSheet(workbook, 'Users', DISPLAY_HEADERS.Users);
    this.addExampleRow(sheet, [
      'Jane Doe',
      'jane.doe@example-school.edu',
      '+919876543210',
      'teacher',
      'Grade 5',
    ]);

    const roleColumn = TAB_HEADERS.Users.indexOf('Role') + 1;
    this.applyDropdown(sheet, roleColumn, [...ALLOWED_ROLES], {
      blocking: true,
    });
  }

  private buildStudentsTab(workbook: ExcelJS.Workbook) {
    const sheet = this.addDataSheet(
      workbook,
      'Students',
      DISPLAY_HEADERS.Students,
    );
    this.addExampleRow(sheet, [
      'Amit Kumar',
      'A-2025-001',
      'Grade 5',
      'A',
      '2015-06-12',
      'Sunita Kumar',
      '+919876543211',
      'sunita.kumar@example.com',
      'A+',
      'General',
      'Engineer',
    ]);

    const bloodGroupColumn = TAB_HEADERS.Students.indexOf('Blood Group') + 1;
    this.applyDropdown(sheet, bloodGroupColumn, BLOOD_GROUP_TEMPLATE_OPTIONS, {
      blocking: true,
    });

    const casteColumn = TAB_HEADERS.Students.indexOf('Caste') + 1;
    this.applyDropdown(sheet, casteColumn, CASTE_TEMPLATE_OPTIONS, {
      blocking: true,
    });
  }

  private buildFeeStructuresTab(workbook: ExcelJS.Workbook) {
    const sheet = this.addDataSheet(
      workbook,
      'Fee Structures',
      DISPLAY_HEADERS['Fee Structures'],
    );
    this.addExampleRow(sheet, [
      'Grade 5',
      'A',
      'Term 1',
      'Tuition',
      '25000',
      '2025-06-15',
      '50',
    ]);

    const componentColumn =
      TAB_HEADERS['Fee Structures'].indexOf('Fee Component') + 1;
    this.applyDropdown(sheet, componentColumn, COMMON_FEE_COMPONENTS, {
      blocking: false,
    });
  }

  private addDataSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    displayHeaders: string[],
  ): ExcelJS.Worksheet {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = displayHeaders.map((header) => ({
      header,
      width: Math.max(header.length + 4, 18),
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return sheet;
  }

  private addExampleRow(sheet: ExcelJS.Worksheet, values: string[]) {
    const row = sheet.addRow(values);
    row.eachCell((cell) => {
      cell.fill = EXAMPLE_ROW_FILL;
    });
  }

  private applyDropdown(
    sheet: ExcelJS.Worksheet,
    column: number,
    options: string[],
    { blocking }: { blocking: boolean },
  ) {
    const formula = `"${options.join(',')}"`;
    for (let row = 2; row <= VALIDATION_ROW_COUNT; row++) {
      sheet.getCell(row, column).dataValidation = {
        type: 'list',
        formulae: [formula],
        allowBlank: true,
        showErrorMessage: blocking,
        error: blocking ? `Must be one of: ${options.join(', ')}` : undefined,
      };
    }
  }
}
