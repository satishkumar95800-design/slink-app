import { BadRequestException, Injectable } from '@nestjs/common';
import { EmploymentType } from '@prisma/client';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import type { Express } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { isValidYmd, toDbDate } from '../attendance/attendance-dates';
import { SENSITIVE_FIELDS, SensitiveField } from './dto/hrms.dto';
import { ENC_COLUMN, hintFor, normalizeSensitive } from './employee-fields';
import { HrCrypto } from './hr-crypto.service';
import { EMPLOYEE_CSV_HEADERS, hrmsStrings as t } from './hrms.strings';
import { audit, fail, withLock } from './hrms.shared';

const MAX_ROWS = 500;
const XLSX_MAGIC = [0x50, 0x4b]; // "PK"

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

interface ParsedRow {
  row: number;
  employeeCode?: string;
  name: string;
  phone?: string;
  email?: string;
  designation: string;
  department?: string;
  employmentType: EmploymentType;
  joinDate: string;
  sensitive: Partial<Record<SensitiveField, string>>;
}

const HEADER_TO_KEY: Record<string, string> = {
  'employee code': 'employeeCode',
  name: 'name',
  phone: 'phone',
  email: 'email',
  designation: 'designation',
  department: 'department',
  'employment type': 'employmentType',
  'join date': 'joinDate',
  pan: 'pan',
  aadhaar: 'aadhaar',
  uan: 'uan',
  'esi number': 'esiNumber',
  'bank account': 'bankAccount',
  ifsc: 'bankIfsc',
  'account holder': 'bankHolder',
};

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown };
    const inner = o.text ?? o.result;
    return typeof inner === 'string' || typeof inner === 'number'
      ? String(inner).trim()
      : '';
  }
  return String(v).trim();
}

/** Accepts YYYY-MM-DD and DD/MM/YYYY (also with - or .). */
export function parseJoinDate(raw: string): string | null {
  const s = raw.trim();
  if (isValidYmd(s)) return s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (!m) return null;
  const ymd = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isValidYmd(ymd) ? ymd : null;
}

@Injectable()
export class EmployeeImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HrCrypto,
  ) {}

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Employees');
    ws.addRow([...EMPLOYEE_CSV_HEADERS]);
    ws.addRow([
      '',
      'Asha Rao',
      '9876543210',
      'asha@example.com',
      'Peon',
      'Support',
      'DAILY_WAGE',
      '01/06/2026',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 20));
    const note = wb.addWorksheet('Notes');
    note.addRow([
      'Employment Type: PERMANENT, CONTRACT, PART_TIME or DAILY_WAGE (default PERMANENT)',
    ]);
    note.addRow([
      'Join Date: DD/MM/YYYY or YYYY-MM-DD. Employee Code is optional (auto-numbered).',
    ]);
    note.addRow([
      'PAN, Aadhaar, UAN, ESI Number and bank details are stored encrypted. Leave blank if unknown.',
    ]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private async read(file: Express.Multer.File): Promise<ExcelJS.Worksheet> {
    if (!file?.buffer?.length)
      fail(BadRequestException, 'IMPORT_NO_FILE', t.importNoFile);
    const wb = new ExcelJS.Workbook();
    try {
      const isXlsx =
        file.buffer[0] === XLSX_MAGIC[0] && file.buffer[1] === XLSX_MAGIC[1];
      if (isXlsx) {
        await wb.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
      } else {
        await wb.csv.read(Readable.from([file.buffer]));
      }
    } catch {
      fail(BadRequestException, 'IMPORT_UNREADABLE', t.importUnreadable);
    }
    const ws = wb.worksheets[0];
    if (!ws) fail(BadRequestException, 'IMPORT_UNREADABLE', t.importUnreadable);
    return ws;
  }

  /** Validates every row; with dryRun false and zero errors, creates all employees in one transaction. */
  async run(
    tenantId: string,
    user: ActiveUser,
    file: Express.Multer.File,
    dryRun: boolean,
  ) {
    const ws = await this.read(file);
    const header = ws.getRow(1);
    const keyByCol = new Map<number, string>();
    header.eachCell((cell, col) => {
      const key = HEADER_TO_KEY[cellText(cell.value).toLowerCase()];
      if (key) keyByCol.set(col, key);
    });
    if (![...keyByCol.values()].includes('name'))
      fail(BadRequestException, 'IMPORT_UNREADABLE', t.importUnreadable);

    const raw: { row: number; values: Record<string, string> }[] = [];
    ws.eachRow((r, n) => {
      if (n === 1) return;
      const values: Record<string, string> = {};
      keyByCol.forEach((key, col) => {
        values[key] = cellText(r.getCell(col).value);
      });
      if (Object.values(values).some((v) => v)) raw.push({ row: n, values });
    });
    if (raw.length === 0)
      fail(BadRequestException, 'IMPORT_EMPTY', t.importEmpty);
    if (raw.length > MAX_ROWS)
      fail(BadRequestException, 'IMPORT_TOO_MANY', t.importTooMany);

    const existing = await this.prisma.employee.findMany({
      where: { tenantId },
      select: { employeeCode: true },
    });
    const takenCodes = new Set(
      existing.map((e) => e.employeeCode.toLowerCase()),
    );
    const errors: ImportRowError[] = [];
    const rows: ParsedRow[] = [];
    const seen = new Set<string>();

    for (const { row, values: v } of raw) {
      const err = (field: string, message: string) =>
        errors.push({ row, field, message });
      if (!v.name) err('name', 'Name is required');
      if (!v.designation) err('designation', 'Designation is required');
      const joinDate = parseJoinDate(v.joinDate ?? '');
      if (!joinDate) err('joinDate', t.invalidDate);
      const type = (v.employmentType || 'PERMANENT')
        .toUpperCase()
        .replace(/[\s-]/g, '_');
      if (!(type in EmploymentType)) err('employmentType', t.invalidField);
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email))
        err('email', t.invalidField);
      if (v.phone && !/^[0-9+\-\s()]{6,20}$/.test(v.phone))
        err('phone', t.invalidField);
      let code = v.employeeCode || undefined;
      if (code) {
        if (!/^[A-Za-z0-9\-_/]{1,30}$/.test(code))
          err('employeeCode', t.invalidField);
        else if (takenCodes.has(code.toLowerCase()))
          err('employeeCode', t.employeeCodeTaken);
        else if (seen.has(code.toLowerCase()))
          err('employeeCode', t.employeeCodeTaken);
        seen.add(code.toLowerCase());
      }
      const sensitive: Partial<Record<SensitiveField, string>> = {};
      for (const f of SENSITIVE_FIELDS) {
        if (!v[f]) continue;
        const n = normalizeSensitive(f, v[f]);
        if (n === null) err(f, t.invalidField);
        else sensitive[f] = n;
      }
      code = code || undefined;
      rows.push({
        row,
        employeeCode: code,
        name: v.name?.replace(/\s+/g, ' ').trim(),
        phone: v.phone || undefined,
        email: v.email || undefined,
        designation: v.designation,
        department: v.department || undefined,
        employmentType: (type in EmploymentType
          ? type
          : 'PERMANENT') as EmploymentType,
        joinDate: joinDate ?? '',
        sensitive,
      });
    }

    const summary = {
      total: rows.length,
      valid: rows.length - new Set(errors.map((e) => e.row)).size,
      errors,
    };
    if (dryRun) return { ...summary, imported: 0, dryRun: true };
    if (errors.length > 0)
      throw new BadRequestException({
        code: 'IMPORT_HAS_ERRORS',
        message: t.importHasErrors,
        errors,
      });

    await withLock(this.prisma, tenantId, 'employees', async (tx) => {
      const codes = await tx.employee.findMany({
        where: { tenantId, employeeCode: { startsWith: 'EMP-' } },
        select: { employeeCode: true },
      });
      let next =
        codes.reduce(
          (m, r) =>
            Math.max(m, Number(/^EMP-(\d+)$/.exec(r.employeeCode)?.[1] ?? 0)),
          0,
        ) + 1;
      const taken = new Set(
        (
          await tx.employee.findMany({
            where: { tenantId },
            select: { employeeCode: true },
          })
        ).map((e) => e.employeeCode.toLowerCase()),
      );
      for (const r of rows) {
        let code = r.employeeCode;
        if (!code) {
          do code = `EMP-${String(next++).padStart(4, '0')}`;
          while (taken.has(code.toLowerCase()));
        } else if (taken.has(code.toLowerCase())) {
          fail(BadRequestException, 'IMPORT_HAS_ERRORS', t.employeeCodeTaken);
        }
        taken.add(code.toLowerCase());
        const enc: Record<string, string> = {};
        const hints: Record<string, string> = {};
        for (const f of SENSITIVE_FIELDS) {
          const val = r.sensitive[f];
          if (val === undefined) continue;
          enc[ENC_COLUMN[f]] = this.crypto.encrypt(val);
          hints[f] = hintFor(f, val);
        }
        await tx.employee.create({
          data: {
            tenantId,
            employeeCode: code,
            name: r.name,
            phone: r.phone ?? null,
            email: r.email ?? null,
            designation: r.designation,
            department: r.department ?? null,
            employmentType: r.employmentType,
            joinDate: toDbDate(r.joinDate),
            createdBy: user.id,
            ...enc,
            sensitiveHints: hints,
          },
        });
      }
      await audit(
        tx,
        tenantId,
        user.id,
        'hrms.employee.import',
        'employee',
        null,
        {
          count: rows.length,
        },
      );
    });
    return { ...summary, imported: rows.length, dryRun: false };
  }
}
