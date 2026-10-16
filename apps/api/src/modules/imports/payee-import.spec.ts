/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake */
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { ActiveUser } from '../../common/types/active-user.type';
import { createDb } from '../hrms/test-db';
import { ImportsController } from './imports.controller';
import { PayeeImportController } from './payee-import.controller';
import { PayeeImportService } from './payee-import.service';
import {
  PAYEE_DISPLAY_HEADERS,
  PAYEE_IMPORT_MAX_ROWS,
  PAYEE_TEMPLATE_FILE_NAME,
} from './payee-tab-schema';
import { PayeeTemplateService } from './payee-template.service';
import { TemplateGeneratorService } from './template-generator.service';
import { WorkbookParserService } from './workbook-parser.service';

const T1 = 't1';
const T2 = 't2';
const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const admin: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: T1,
  name: 'a',
  isVerified: true,
};

type Cells = Array<string | undefined>;

/** Generates the real template, drops the example rows and fills in the given rows. */
async function fillTemplate(
  groundStaff: Cells[],
  vendors: Cells[],
): Promise<Buffer> {
  const buf = await new PayeeTemplateService().generate();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const gs = wb.getWorksheet('Ground Staff')!;
  const vn = wb.getWorksheet('Vendors')!;
  // The dropdown validations pre-create rows up to 500, so write in place
  // (addRow would append after them) and clear the example row first.
  const put = (sheet: ExcelJS.Worksheet, rows: Cells[]) => {
    sheet.getRow(2).eachCell((cell) => (cell.value = null));
    rows.forEach((r, i) =>
      r.forEach((v, c) => {
        if (v !== undefined) sheet.getCell(2 + i, 1 + c).value = v;
      }),
    );
  };
  put(gs, groundStaff);
  put(vn, vendors);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const file = (buffer: Buffer, mimetype = XLSX) =>
  ({ buffer, mimetype, originalname: 'payees.xlsx' }) as never;

function setup(features: Record<string, boolean> = { pettyCash: true }) {
  const db = createDb({
    tenant: [
      { id: T1, features },
      { id: T2, features: { pettyCash: true } },
    ],
  });
  const importer = new PayeeImportService(
    new WorkbookParserService(),
    db.prisma as never,
  );
  const controller = new PayeeImportController(
    importer,
    new PayeeTemplateService(),
    db.prisma as never,
  );
  return { db, importer, controller };
}

const GS_OK: Cells = ['Ramesh Kumar', '+919876543210', 'Gardener', 'Mornings'];
const V_OK: Cells = [
  'Sri Lakshmi Travels',
  'Bus / Transport',
  'Suresh Babu',
  '+919845012345',
  'KA 01 AB 1234, Route 3',
  'Invoice on the 5th',
];

describe('PayeeTemplateService', () => {
  const load = async () => {
    const wb = new ExcelJS.Workbook();
    const buf = await new PayeeTemplateService().generate();
    await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
    return wb;
  };

  it('has Instructions, Ground Staff and Vendors tabs only', async () => {
    const wb = await load();
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Instructions',
      'Ground Staff',
      'Vendors',
    ]);
  });

  it('writes the display headers (required columns starred) and freezes the header row', async () => {
    const wb = await load();
    for (const [tab, headers] of Object.entries(PAYEE_DISPLAY_HEADERS)) {
      const sheet = wb.getWorksheet(tab)!;
      const values = (sheet.getRow(1).values as unknown[]).slice(1);
      expect(values).toEqual(headers);
      expect(sheet.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    }
    expect(PAYEE_DISPLAY_HEADERS['Ground Staff']).toContain('Full Name*');
    expect(PAYEE_DISPLAY_HEADERS.Vendors).toContain('Vendor Name*');
  });

  it('has one highlighted example row per data tab, filled for every column', async () => {
    const wb = await load();
    for (const tab of ['Ground Staff', 'Vendors']) {
      const sheet = wb.getWorksheet(tab)!;
      expect(sheet.getCell(3, 1).value).toBeNull();
      const row = sheet.getRow(2);
      const values = (row.values as unknown[]).slice(1);
      expect(values.length).toBe(
        PAYEE_DISPLAY_HEADERS[tab as 'Vendors'].length,
      );
      expect(values.every((v) => v)).toBe(true);
      expect((row.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe(
        'FFFFF2CC',
      );
    }
  });

  it('offers non-blocking dropdown suggestions', async () => {
    const wb = await load();
    const v = wb.getWorksheet('Vendors')!.getCell(3, 2).dataValidation;
    expect(v?.type).toBe('list');
    expect(v?.showErrorMessage).toBeFalsy();
  });

  it('round-trips through the parser with starred headers', async () => {
    const buf = await new PayeeTemplateService().generate();
    const tabs = await new WorkbookParserService().parseTabs(buf, [
      { name: 'Ground Staff', headers: ['Full Name', 'Phone Number'] },
      { name: 'Vendors', headers: ['Vendor Name'] },
    ]);
    expect(tabs['Ground Staff'].rows[0].cells['Full Name']).toBe(
      'Ramesh Kumar',
    );
    expect(tabs.Vendors.rows[0].cells['Vendor Name']).toBe(
      'Sri Lakshmi Travels',
    );
  });
});

describe('PayeeImportService.validate', () => {
  it('accepts a good file and writes nothing', async () => {
    const { importer, db } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate([GS_OK], [V_OK]),
    );
    expect(report.canImport).toBe(true);
    expect(report.totalErrors).toBe(0);
    expect(report.tabs.map((t) => [t.tab, t.rowCount])).toEqual([
      ['Ground Staff', 1],
      ['Vendors', 1],
    ]);
    expect(db.table('pettyCashPayee')).toHaveLength(0);
    expect(db.table('auditLog')).toHaveLength(0);
  });

  it('reports a missing name, per row and column', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate([['', '+919876543210']], [['', 'Bus / Transport']]),
    );
    expect(report.canImport).toBe(false);
    expect(report.tabs[0].errors[0]).toMatchObject({
      tab: 'Ground Staff',
      row: 2,
      column: 'Full Name',
      reason: 'is required',
    });
    expect(report.tabs[1].errors[0]).toMatchObject({
      tab: 'Vendors',
      column: 'Vendor Name',
    });
  });

  it('rejects a bad phone, requires phone for ground staff, allows blank vendor phone', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate(
        [
          ['A One', '98765'],
          ['B Two', ''],
        ],
        [['Vendor No Phone'], ['Vendor Bad Phone', '', '', 'abc']],
      ),
    );
    expect(report.tabs[0].errors.map((e) => [e.row, e.column])).toEqual([
      [2, 'Phone Number'],
      [3, 'Phone Number'],
    ]);
    expect(report.tabs[1].errors.map((e) => e.row)).toEqual([3]);
  });

  it('flags duplicates inside the file as errors (same tab, same name, compatible phone)', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate(
        [
          GS_OK,
          ['  ramesh   KUMAR ', '+919876543210'],
          ['Ramesh Kumar', '+919000000000'], // different phone: a different person
        ],
        [],
      ),
    );
    expect(report.tabs[0].errors).toHaveLength(1);
    expect(report.tabs[0].errors[0].row).toBe(3);
    expect(report.tabs[0].errors[0].reason).toMatch(/duplicate of row 2/);
  });

  it('allows the same name as a ground staff member and as a vendor', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate([['Ravi', '+919876543210']], [['Ravi']]),
    );
    expect(report.totalErrors).toBe(0);
  });

  it('warns and skips rows already registered (any status), within the same type only', async () => {
    const { importer, db } = setup();
    db.table('pettyCashPayee').push(
      {
        id: 'p1',
        tenantId: T1,
        type: 'GROUND_STAFF',
        name: 'ramesh kumar',
        phone: null,
        isActive: false,
      },
      {
        id: 'p2',
        tenantId: T1,
        type: 'GROUND_STAFF',
        name: 'Other',
        phone: '+919111111111',
        isActive: true,
      },
    );
    const report = await importer.validate(
      T1,
      await fillTemplate([GS_OK], [['Ramesh Kumar']]),
    );
    expect(report.canImport).toBe(true);
    expect(report.tabs[0].skipped).toBe(1);
    expect(report.tabs[0].warnings[0].reason).toMatch(
      /already registered \(inactive\)/,
    );
    expect(report.tabs[1].skipped).toBe(0);
  });

  it('warns when a phone already belongs to a different payee of the same type', async () => {
    const { importer, db } = setup();
    db.table('pettyCashPayee').push({
      id: 'p2',
      tenantId: T1,
      type: 'GROUND_STAFF',
      name: 'Other',
      phone: '+919876543210',
      isActive: true,
    });
    const report = await importer.validate(T1, await fillTemplate([GS_OK], []));
    expect(report.totalErrors).toBe(0);
    expect(report.tabs[0].warnings[0].column).toBe('Phone Number');
  });

  it('warns about vehicle details on a non-transport vendor', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate([], [['Paper Co', 'Stationery', '', '', 'KA 01']]),
    );
    expect(report.totalErrors).toBe(0);
    expect(report.tabs[1].warnings[0].column).toBe('Vehicle / Route Details');
  });

  it('errors when the combined notes exceed 500 characters', async () => {
    const { importer } = setup();
    const report = await importer.validate(
      T1,
      await fillTemplate(
        [['Long', '+919876543210', 'Peon', 'x'.repeat(500)]],
        [],
      ),
    );
    expect(report.tabs[0].errors[0].column).toBe('Notes');
  });

  it('enforces the row limit and refuses empty files', async () => {
    const { importer } = setup();
    const many = Array.from({ length: PAYEE_IMPORT_MAX_ROWS + 1 }, (_, i) => [
      `Worker ${i}`,
      '+919876543210',
    ]);
    await expect(
      importer.validate(T1, await fillTemplate(many, [])),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_TOO_MANY' } });
    await expect(
      importer.validate(T1, await fillTemplate([], [])),
    ).rejects.toMatchObject({ response: { code: 'IMPORT_EMPTY' } });
    const atLimit = Array.from({ length: PAYEE_IMPORT_MAX_ROWS }, (_, i) => [
      `Worker ${i}`,
      '+919876543210',
    ]);
    const ok = await importer.validate(T1, await fillTemplate(atLimit, []));
    expect(ok.totalErrors).toBe(0);
  });

  it('rejects the onboarding template (missing tabs) and non-xlsx bytes', async () => {
    const { importer } = setup();
    const onboarding = await new TemplateGeneratorService().generate();
    await expect(importer.validate(T1, onboarding)).rejects.toThrow(
      /Missing required tab\(s\): Ground Staff, Vendors/,
    );
    await expect(
      importer.validate(T1, Buffer.from('not a workbook')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PayeeImportService.commit', () => {
  it('creates active payees with the right types, phones and notes, plus audit entries', async () => {
    const { importer, db } = setup();
    const out = await importer.commit(
      T1,
      admin,
      await fillTemplate([GS_OK], [V_OK, ['Cleaning Co']]),
    );
    expect(out.summary).toEqual({
      groundStaff: { created: 1, skipped: 0 },
      vendors: { created: 2, skipped: 0 },
    });
    const rows = db.table('pettyCashPayee');
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.name === 'Ramesh Kumar')).toMatchObject({
      tenantId: T1,
      type: 'GROUND_STAFF',
      phone: '+919876543210',
      notes: 'Role: Gardener | Mornings',
      isActive: true,
    });
    expect(rows.find((r) => r.name === 'Sri Lakshmi Travels')).toMatchObject({
      type: 'VENDOR',
      phone: '+919845012345',
      notes:
        'Service: Bus / Transport | Contact: Suresh Babu | Vehicle/Route: KA 01 AB 1234, Route 3 | Invoice on the 5th',
      isActive: true,
    });
    expect(rows.find((r) => r.name === 'Cleaning Co')).toMatchObject({
      type: 'VENDOR',
      phone: null,
      notes: null,
    });
    const audits = db.table('auditLog');
    expect(
      audits.filter((a) => a.action === 'petty_cash.payee.create'),
    ).toHaveLength(3);
    const imp = audits.filter((a) => a.action === 'petty_cash.payee.import');
    expect(imp).toHaveLength(1);
    expect(imp[0]).toMatchObject({
      tenantId: T1,
      actorId: 'admin-1',
      diff: out.summary,
    });
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('is all-or-nothing: any error returns 422 with the report and writes nothing', async () => {
    const { importer, db } = setup();
    const err = await importer
      .commit(
        T1,
        admin,
        await fillTemplate([GS_OK, ['', '+919876543210']], [V_OK]),
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnprocessableEntityException);
    expect((err as UnprocessableEntityException).getResponse()).toMatchObject({
      canImport: false,
      totalErrors: 1,
    });
    expect(db.table('pettyCashPayee')).toHaveLength(0);
  });

  it('skips already-registered payees and a re-run creates nothing new', async () => {
    const { importer, db } = setup();
    const buf = await fillTemplate([GS_OK], [V_OK]);
    await importer.commit(T1, admin, buf);
    const again = await importer.commit(T1, admin, buf);
    expect(again.summary).toEqual({
      groundStaff: { created: 0, skipped: 1 },
      vendors: { created: 0, skipped: 1 },
    });
    expect(db.table('pettyCashPayee')).toHaveLength(2);
  });

  it("is tenant-scoped: another school's payees neither block nor receive rows", async () => {
    const { importer, db } = setup();
    db.table('pettyCashPayee').push({
      id: 'other',
      tenantId: T2,
      type: 'GROUND_STAFF',
      name: 'Ramesh Kumar',
      phone: '+919876543210',
      isActive: true,
    });
    const out = await importer.commit(
      T1,
      admin,
      await fillTemplate([GS_OK], []),
    );
    expect(out.summary.groundStaff.created).toBe(1);
    const mine = db.table('pettyCashPayee').filter((r) => r.tenantId === T1);
    expect(mine).toHaveLength(1);
    expect(
      db.table('pettyCashPayee').filter((r) => r.tenantId === T2),
    ).toHaveLength(1);
  });
});

describe('PayeeImportController', () => {
  const res = () => {
    const r = { set: jest.fn(), send: jest.fn() };
    return r as unknown as Response & typeof r;
  };

  it('every route answers 403 FEATURE_DISABLED when pettyCash is off or missing', async () => {
    const offStates: Array<Record<string, boolean>> = [
      { pettyCash: false },
      {},
    ];
    for (const features of offStates) {
      const { controller } = setup(features);
      const buf = await fillTemplate([GS_OK], []);
      const calls = [
        () => controller.downloadTemplate(T1, res()),
        () => controller.validate(file(buf), T1),
        () => controller.commit(file(buf), T1, admin),
      ];
      for (const call of calls) {
        const err = await call().catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ForbiddenException);
        expect((err as ForbiddenException).getResponse()).toMatchObject({
          code: 'FEATURE_DISABLED',
        });
      }
    }
  });

  it('flag-off commit writes nothing', async () => {
    const { controller, db } = setup({ pettyCash: false });
    await controller
      .commit(file(await fillTemplate([GS_OK], [])), T1, admin)
      .catch(() => undefined);
    expect(db.table('pettyCashPayee')).toHaveLength(0);
  });

  it('serves the template with the xlsx headers when enabled', async () => {
    const { controller } = setup();
    const r = res();
    await controller.downloadTemplate(T1, r);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest mock
    expect(r.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': XLSX,
        'Content-Disposition': `attachment; filename="${PAYEE_TEMPLATE_FILE_NAME}"`,
      }),
    );
    expect(Buffer.isBuffer(r.send.mock.calls[0][0])).toBe(true);
  });

  it('refuses missing files and non-xlsx mime types', async () => {
    const { controller } = setup();
    await expect(controller.validate(undefined as never, T1)).rejects.toThrow(
      'No file provided',
    );
    await expect(
      controller.validate(file(Buffer.from('x'), 'text/csv'), T1),
    ).rejects.toThrow('Only .xlsx files are accepted');
  });

  it('end to end: download template, fill, validate, commit, payees exist for that tenant', async () => {
    const { controller, db } = setup();
    const r = res();
    await controller.downloadTemplate(T1, r);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(r.send.mock.calls[0][0]);
    const gs = wb.getWorksheet('Ground Staff')!;
    const vn = wb.getWorksheet('Vendors')!;
    gs.spliceRows(2, 1);
    vn.spliceRows(2, 1);
    gs.addRow(['Lakshmi Devi', '+919800000001', 'Cleaner']);
    gs.addRow(['Mohan', '+919800000002', 'Security Guard']);
    vn.addRow([
      'City Buses',
      'Bus / Transport',
      'Raju',
      '+919800000003',
      'Route 7',
    ]);
    const upload = file(Buffer.from(await wb.xlsx.writeBuffer()));

    const report = await controller.validate(upload, T1);
    expect(report).toMatchObject({ canImport: true, totalErrors: 0 });
    expect(db.table('pettyCashPayee')).toHaveLength(0);

    const out = await controller.commit(upload, T1, admin);
    expect(out.summary).toEqual({
      groundStaff: { created: 2, skipped: 0 },
      vendors: { created: 1, skipped: 0 },
    });
    const rows = db.table('pettyCashPayee');
    expect(rows.map((p) => [p.type, p.name, p.tenantId]).sort()).toEqual([
      ['GROUND_STAFF', 'Lakshmi Devi', T1],
      ['GROUND_STAFF', 'Mohan', T1],
      ['VENDOR', 'City Buses', T1],
    ]);
    // payees list through the same filter petty-cash listPayees uses
    expect(rows.every((p) => p.isActive)).toBe(true);
  });
});

describe('access and isolation from the onboarding import', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (
    cls: new (...a: never[]) => unknown,
    handler: string,
    role: Role | undefined,
  ): ExecutionContext =>
    ({
      getHandler: () => (cls.prototype as Record<string, unknown>)[handler],
      getClass: () => cls,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined, tenantId: T1 }),
      }),
    }) as unknown as ExecutionContext;

  const handlers = ['downloadTemplate', 'validate', 'commit'];

  it.each(handlers)(
    '%s: admin, accounts and super_admin allowed; parent, teacher, anonymous refused',
    (h) => {
      const allowed = (role?: Role) =>
        guard.canActivate(ctx(PayeeImportController, h, role));
      expect(allowed(Role.admin)).toBe(true);
      expect(allowed(Role.accounts)).toBe(true);
      expect(allowed(Role.super_admin)).toBe(true);
      expect(allowed(Role.parent)).toBe(false);
      expect(allowed(Role.teacher)).toBe(false);
      expect(allowed(undefined)).toBe(false);
    },
  );

  it('the onboarding controller keeps its admin + super_admin audience', () => {
    for (const h of ['downloadTemplate', 'validate', 'commit']) {
      const allowed = (role: Role) =>
        guard.canActivate(ctx(ImportsController, h, role));
      expect(allowed(Role.admin)).toBe(true);
      expect(allowed(Role.super_admin)).toBe(true);
      expect(allowed(Role.accounts)).toBe(false);
    }
  });

  it('the onboarding template is unchanged: still exactly its 6 tabs, no vendor/ground-staff tab', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      (await new TemplateGeneratorService().generate()) as unknown as Parameters<
        typeof wb.xlsx.load
      >[0],
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Instructions',
      'Classes',
      'Users',
      'Teachers',
      'Students',
      'Fee Structures',
    ]);
  });

  it('the onboarding parser rejects the vendors template (missing tabs)', async () => {
    const buf = await new PayeeTemplateService().generate();
    await expect(new WorkbookParserService().parse(buf)).rejects.toThrow(
      /Missing required tab/,
    );
  });
});
