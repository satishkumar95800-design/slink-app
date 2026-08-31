import { Injectable, BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { ParsedTab, ParsedWorkbook } from './types';
import { REQUIRED_TABS, TAB_HEADERS } from './tab-schema';

@Injectable()
export class WorkbookParserService {
  async parse(buffer: Buffer): Promise<ParsedWorkbook> {
    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs's .d.ts targets the pre-@types/node-24 non-generic Buffer type
      await workbook.xlsx.load(
        buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
      );
    } catch {
      throw new BadRequestException(
        'File could not be read — make sure it is a valid .xlsx file',
      );
    }

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    const missingTabs = REQUIRED_TABS.filter(
      (tabName) => !sheetNames.includes(tabName),
    );
    if (missingTabs.length > 0) {
      throw new BadRequestException(
        `Missing required tab(s): ${missingTabs.join(', ')}`,
      );
    }

    return {
      classes: this.parseTab(workbook, 'Classes', TAB_HEADERS.Classes),
      users: this.parseTab(workbook, 'Users', TAB_HEADERS.Users),
      students: this.parseTab(workbook, 'Students', TAB_HEADERS.Students),
      feeStructures: this.parseTab(
        workbook,
        'Fee Structures',
        TAB_HEADERS['Fee Structures'],
      ),
    };
  }

  private parseTab(
    workbook: ExcelJS.Workbook,
    sheetName: string,
    expectedHeaders: string[],
  ): ParsedTab {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      throw new BadRequestException(`Tab "${sheetName}" could not be read`);
    }

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell) => {
      headers.push(this.normalizeHeader(this.cellToString(cell.value)));
    });

    const missingHeaders = expectedHeaders.filter(
      (header) => !headers.includes(header),
    );
    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `Tab "${sheetName}" is missing required column(s): ${missingHeaders.join(', ')}`,
      );
    }
    const extraColumns = headers.filter(
      (header) => !expectedHeaders.includes(header),
    );

    const rows: ParsedTab['rows'] = [];
    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const cells: Record<string, string> = {};
      headers.forEach((header, idx) => {
        cells[header] = this.cellToString(row.getCell(idx + 1).value).trim();
      });

      const isEmpty = Object.values(cells).every((value) => value === '');
      if (isEmpty) continue;

      rows.push({ rowNumber, cells });
    }

    return { headers, extraColumns, rows };
  }

  /** Strips a trailing "*" (used in the template to mark required columns) and surrounding whitespace */
  private normalizeHeader(raw: string): string {
    return raw.replace(/\*\s*$/, '').trim();
  }

  private cellToString(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === 'object') {
      if ('richText' in value)
        return value.richText.map((fragment) => fragment.text).join('');
      if ('text' in value) return String(value.text);
      if ('result' in value) return this.cellToString(value.result ?? '');
      return '';
    }
    return String(value);
  }
}
