/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake */
import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  EmployeeImportService,
  parseJoinDate,
} from './employee-import.service';
import { HrCrypto } from './hr-crypto.service';
import { createDb } from './test-db';

const T1 = 't1';
const user: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: T1,
  name: 'a',
  isVerified: true,
};
const HEADER =
  'Employee Code,Name,Phone,Email,Designation,Department,Employment Type,Join Date,PAN,Aadhaar,UAN,ESI Number,Bank Account,IFSC,Account Holder';
const csv = (...rows: string[]) =>
  ({
    buffer: Buffer.from([HEADER, ...rows].join('\n')),
    originalname: 'staff.csv',
    mimetype: 'text/csv',
  }) as never;

function setup() {
  const db = createDb({
    employee: [
      { id: 'e0', tenantId: T1, employeeCode: 'EMP-0001', name: 'Existing' },
    ],
  });
  const crypto = new HrCrypto({ get: () => 'k'.repeat(40) } as never);
  return { db, svc: new EmployeeImportService(db.prisma as never, crypto) };
}

describe('parseJoinDate', () => {
  it.each([
    ['2026-04-01', '2026-04-01'],
    ['01/04/2026', '2026-04-01'],
    ['1-4-2026', '2026-04-01'],
    ['31.12.2025', '2025-12-31'],
  ])('%s -> %s', (raw, want) => expect(parseJoinDate(raw)).toBe(want));
  it.each(['', '30/02/2026', '2026-13-01', 'yesterday'])(
    '%s is refused',
    (raw) => expect(parseJoinDate(raw)).toBeNull(),
  );
});

describe('EmployeeImportService', () => {
  it('dry run validates and writes nothing', async () => {
    const { svc, db } = setup();
    const out = await svc.run(
      T1,
      user,
      csv(
        ',Asha Rao,9876543210,,Peon,Support,DAILY_WAGE,01/06/2026,,,,,,,',
        ',,9876543211,,Cook,Kitchen,CONTRACT,01/06/2026,,,,,,,',
      ),
      true,
    );
    expect(out).toMatchObject({
      total: 2,
      valid: 1,
      imported: 0,
      dryRun: true,
    });
    expect(out.errors).toEqual([
      { row: 3, field: 'name', message: expect.any(String) },
    ]);
    expect(db.table('employee')).toHaveLength(1);
  });

  it('imports every row or none, numbering codes and encrypting sensitive columns', async () => {
    const { svc, db } = setup();
    const out = await svc.run(
      T1,
      user,
      csv(
        ',Asha Rao,9876543210,,Peon,Support,DAILY_WAGE,01/06/2026,ABCDE1234F,,,,123456789012,HDFC0001234,Asha Rao',
        'X-77,Ravi,,,Cook,Kitchen,,2026-06-01,,,,,,,',
      ),
      false,
    );
    expect(out.imported).toBe(2);
    const rows = db.table('employee');
    expect(rows.map((r) => r.employeeCode)).toEqual([
      'EMP-0001',
      'EMP-0002',
      'X-77',
    ]);
    expect(rows[1].panEnc).toMatch(/^v1:/);
    expect(rows[1].bankAccountEnc).not.toContain('123456789012');
    expect(rows[1].employmentType).toBe('DAILY_WAGE');
    expect(rows[2].employmentType).toBe('PERMANENT');
    expect(JSON.stringify(db.table('auditLog'))).not.toContain('ABCDE1234F');
  });

  it('refuses the whole file when any row has an error', async () => {
    const { svc, db } = setup();
    await expect(
      svc.run(
        T1,
        user,
        csv(
          ',Good,,,Peon,,PERMANENT,01/06/2026,,,,,,,',
          ',Bad PAN,,,Peon,,PERMANENT,01/06/2026,12345,,,,,,',
        ),
        false,
      ),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_HAS_ERRORS' } });
    expect(db.table('employee')).toHaveLength(1);
  });

  it('flags duplicate and already-used codes and bad dates or types', async () => {
    const { svc } = setup();
    const out = await svc.run(
      T1,
      user,
      csv(
        'EMP-0001,A,,,Peon,,PERMANENT,01/06/2026,,,,,,,',
        'N-1,B,,,Peon,,PERMANENT,01/06/2026,,,,,,,',
        'n-1,C,,,Peon,,PERMANENT,01/06/2026,,,,,,,',
        ',D,,,Peon,,SEASONAL,31/02/2026,,,,,,,',
      ),
      true,
    );
    expect(out.errors.map((e) => `${e.row}:${e.field}`).sort()).toEqual([
      '2:employeeCode',
      '4:employeeCode',
      '5:employmentType',
      '5:joinDate',
    ]);
  });

  it('reads an xlsx file too, and rejects junk', async () => {
    const { svc } = setup();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Employees');
    ws.addRow(HEADER.split(','));
    ws.addRow([
      '',
      'Xlsx Person',
      '',
      '',
      'Peon',
      '',
      'PART_TIME',
      '01/06/2026',
    ]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const out = await svc.run(
      T1,
      user,
      { buffer, originalname: 'a.xlsx' } as never,
      true,
    );
    expect(out).toMatchObject({ total: 1, valid: 1 });
    await expect(
      svc.run(T1, user, { buffer: Buffer.alloc(0) } as never, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.run(
        T1,
        user,
        { buffer: Buffer.from('no,header\n1,2') } as never,
        true,
      ),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_UNREADABLE' } });
  });

  it('serves a template with the expected headers', async () => {
    const { svc } = setup();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await svc.template()) as never);
    expect(wb.worksheets[0].getRow(1).getCell(2).value).toBe('Name');
  });
});
