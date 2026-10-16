import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  GROUND_STAFF_ROLE_OPTIONS,
  GROUND_STAFF_TAB,
  PAYEE_DISPLAY_HEADERS,
  PAYEE_TAB_HEADERS,
  VENDORS_TAB,
  VENDOR_SERVICE_TYPE_OPTIONS,
} from './payee-tab-schema';

const EXAMPLE_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF2CC' },
};
const VALIDATION_ROW_COUNT = 500;

/** Builds the separate "Vendors & Ground Staff" template (same conventions as TemplateGeneratorService). */
@Injectable()
export class PayeeTemplateService {
  async generate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Schoolinkd';

    this.buildInstructionsTab(workbook);

    const gs = this.addDataSheet(
      workbook,
      GROUND_STAFF_TAB,
      PAYEE_DISPLAY_HEADERS[GROUND_STAFF_TAB],
    );
    this.addExampleRow(gs, [
      'Ramesh Kumar',
      '+919876543210',
      'Gardener',
      'Works mornings only',
    ]);
    this.applyDropdown(
      gs,
      PAYEE_TAB_HEADERS[GROUND_STAFF_TAB].indexOf('Role / Designation') + 1,
      GROUND_STAFF_ROLE_OPTIONS,
    );

    const vendors = this.addDataSheet(
      workbook,
      VENDORS_TAB,
      PAYEE_DISPLAY_HEADERS[VENDORS_TAB],
    );
    this.addExampleRow(vendors, [
      'Sri Lakshmi Travels',
      'Bus / Transport',
      'Suresh Babu',
      '+919845012345',
      'KA 01 AB 1234, Route 3 (Indiranagar - School)',
      'Monthly invoice on the 5th',
    ]);
    this.applyDropdown(
      vendors,
      PAYEE_TAB_HEADERS[VENDORS_TAB].indexOf('Service Type') + 1,
      VENDOR_SERVICE_TYPE_OPTIONS,
    );

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as unknown as Buffer;
  }

  private buildInstructionsTab(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet('Instructions');
    sheet.columns = [{ width: 100 }];
    const lines = [
      'Schoolinkd — Vendors & Ground Staff Template',
      '',
      'Adds people and companies to the Petty Cash payee list (the people you pay in cash).',
      'This is separate from the main school onboarding template. Fill either tab or both:',
      '  1. Ground Staff — gardeners, peons, cleaners, drivers and other non-teaching staff paid in cash',
      '  2. Vendors — third parties such as bus/transport operators, stationery or maintenance suppliers',
      '',
      'Each data tab has one highlighted example row with sample values.',
      'Delete the highlighted row before importing — it is not a real record.',
      '',
      'Required columns are marked with * in the header. Do not rename, retype, or remove any columns',
      '(the * is part of the exact header text the importer matches on).',
      '',
      'Phone numbers use international format with a leading +, e.g. +919876543210.',
      'Ground Staff need a phone number; for Vendors it is optional.',
      'Role / Designation, Service Type, Contact Person and Vehicle / Route Details are saved in the',
      'payee notes, so they show up next to the name in the Petty Cash payee list.',
      '',
      'Duplicates: two rows with the same name (and the same phone) in one tab are an error.',
      'A row that matches someone already in the payee list is skipped, not overwritten.',
      'Imported payees are created as active.',
      '',
      'Once this file is filled in, upload it under Vendors & Ground Staff on the Import Data screen',
      'and click Validate. Nothing is saved until you click Import.',
    ];
    lines.forEach((line, idx) => {
      const cell = sheet.getCell(idx + 1, 1);
      cell.value = line;
      if (idx === 0) cell.font = { bold: true, size: 14 };
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

  /** Non-blocking suggestions: free text stays allowed. */
  private applyDropdown(
    sheet: ExcelJS.Worksheet,
    column: number,
    options: string[],
  ) {
    const formula = `"${options.join(',')}"`;
    for (let row = 2; row <= VALIDATION_ROW_COUNT; row++) {
      sheet.getCell(row, column).dataValidation = {
        type: 'list',
        formulae: [formula],
        allowBlank: true,
        showErrorMessage: false,
      };
    }
  }
}
