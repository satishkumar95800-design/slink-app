/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake and plain seed rows */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { EmployeesService } from './employees.service';
import { HrCrypto } from './hr-crypto.service';
import { createDb } from './test-db';

const KEY = 'k'.repeat(40);
const T1 = 't1';
const T2 = 't2';
const actor = (role: Role = Role.accounts, tenantId = T1): ActiveUser => ({
  id: `${role}-1`,
  role,
  tenantId,
  name: role,
  isVerified: true,
});

function setup() {
  const db = createDb({
    user: [
      {
        id: 'u-teacher',
        tenantId: T1,
        name: 'Tara Teacher',
        phone: '9000000001',
        email: null,
        role: 'teacher',
      },
      {
        id: 'u-parent',
        tenantId: T1,
        name: 'Pat Parent',
        phone: '9000000002',
        email: null,
        role: 'parent',
      },
      {
        id: 'u-other',
        tenantId: T2,
        name: 'Other School',
        phone: '9000000003',
        email: null,
        role: 'teacher',
      },
    ],
  });
  const files = {
    upload: jest.fn(),
    getSignedUrl: jest.fn(),
    delete: jest.fn(),
  };
  const crypto = new HrCrypto({ get: () => KEY } as never);
  const svc = new EmployeesService(db.prisma as never, crypto, files as never);
  const base = {
    name: 'Ravi Kumar',
    designation: 'Peon',
    joinDate: '2026-04-01',
  };
  return { db, svc, crypto, files, base };
}

describe('EmployeesService: sensitive fields', () => {
  it('encrypts at rest and returns only masks', async () => {
    const { svc, db, base } = setup();
    const v = await svc.create(T1, actor(), {
      ...base,
      pan: 'abcde1234f',
      aadhaar: '1234 5678 9012',
      bankAccount: '123456789012',
      bankIfsc: 'hdfc0001234',
      bankHolder: 'Ravi Kumar',
    });
    const row = db.table('employee')[0];
    expect(row.panEnc).toMatch(/^v1:/);
    expect(row.panEnc).not.toContain('ABCDE1234F');
    expect(row.bankAccountEnc).not.toContain('123456789012');
    expect(v.masked.pan).toBe('XXXXXX234F');
    expect(v.masked.aadhaar).toBe('XXXXXXXX9012');
    expect(v.masked.bankAccount).toBe('XXXXXXXX9012');
    const serialized = JSON.stringify(v);
    for (const secret of [
      'ABCDE1234F',
      '123456789012',
      'HDFC0001234',
      '1234 5678',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect((v as Record<string, unknown>).panEnc).toBeUndefined();
    expect(v.hasBankDetails).toBe(true);
  });

  it('never writes plain sensitive values to the audit log', async () => {
    const { svc, db, base } = setup();
    await svc.create(T1, actor(), {
      ...base,
      pan: 'ABCDE1234F',
      bankAccount: '123456789012',
      bankIfsc: 'HDFC0001234',
    });
    await svc.update(T1, actor(), db.table('employee')[0].id, {
      pan: 'ZZZZZ9999Z',
    });
    const logged = JSON.stringify(db.table('auditLog'));
    for (const secret of [
      'ABCDE1234F',
      'ZZZZZ9999Z',
      '123456789012',
      'HDFC0001234',
    ]) {
      expect(logged).not.toContain(secret);
    }
    expect(
      db
        .table('auditLog')
        .some(
          (a) =>
            a.action === 'hrms.employee.update' &&
            a.diff.sensitiveFieldsChanged.includes('pan'),
        ),
    ).toBe(true);
  });

  it('rejects malformed identifiers', async () => {
    const { svc, base } = setup();
    await expect(
      svc.create(T1, actor(), { ...base, pan: '12345' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.create(T1, actor(), { ...base, aadhaar: '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.create(T1, actor(), { ...base, bankIfsc: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.create(T1, actor(), { ...base, bankAccount: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reveal returns the full values and audit-logs the field names only', async () => {
    const { svc, db, base } = setup();
    const v = await svc.create(T1, actor(), {
      ...base,
      pan: 'ABCDE1234F',
      bankAccount: '123456789012',
    });
    const out = await svc.reveal(T1, actor(Role.admin), v.id, ['pan']);
    expect(out.values).toEqual({ pan: 'ABCDE1234F' });
    const entry = db
      .table('auditLog')
      .find((a) => a.action === 'hrms.employee.reveal');
    expect(entry.diff).toEqual({ fields: ['pan'] });
    expect(JSON.stringify(entry)).not.toContain('ABCDE1234F');
    const all = await svc.reveal(T1, actor(), v.id);
    expect(all.values).toEqual({
      pan: 'ABCDE1234F',
      bankAccount: '123456789012',
    });
  });

  it('clear[] erases a stored value and its mask', async () => {
    const { svc, base } = setup();
    const v = await svc.create(T1, actor(), { ...base, pan: 'ABCDE1234F' });
    const u = await svc.update(T1, actor(), v.id, { clear: ['pan'] });
    expect(u.masked.pan).toBeNull();
  });

  it('refuses to store secrets when the server key is missing', async () => {
    const db = createDb();
    const svc = new EmployeesService(
      db.prisma as never,
      new HrCrypto({ get: () => undefined } as never),
      {} as never,
    );
    await expect(
      svc.create(T1, actor(), {
        name: 'A',
        designation: 'B',
        joinDate: '2026-04-01',
        pan: 'ABCDE1234F',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PAYMENT_SECRETS_KEY_MISSING' },
    });
  });
});

describe('EmployeesService: directory', () => {
  it('auto-numbers employee codes per school and rejects duplicates', async () => {
    const { svc, base } = setup();
    const a = await svc.create(T1, actor(), base);
    const b = await svc.create(T1, actor(), { ...base, name: 'Second' });
    expect([a.employeeCode, b.employeeCode]).toEqual(['EMP-0001', 'EMP-0002']);
    await expect(
      svc.create(T1, actor(), { ...base, employeeCode: 'emp-0001' }),
    ).rejects.toMatchObject({
      response: { code: 'CODE_TAKEN' },
    });
    // another school can reuse the code
    const other = await svc.create(T2, actor(Role.accounts, T2), {
      ...base,
      employeeCode: 'EMP-0001',
    });
    expect(other.employeeCode).toBe('EMP-0001');
  });

  it('is tenant scoped: another school cannot read, edit or reveal', async () => {
    const { svc, base } = setup();
    const a = await svc.create(T1, actor(), { ...base, pan: 'ABCDE1234F' });
    await expect(svc.get(T2, a.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.update(T2, actor(Role.admin, T2), a.id, { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.reveal(T2, actor(Role.admin, T2), a.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      svc.exit(T2, actor(Role.admin, T2), a.id, { exitDate: '2026-05-01' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((await svc.list(T2, {})).total).toBe(0);
  });

  it('exits keep the record (no hard delete) and can be reversed', async () => {
    const { svc, db, base } = setup();
    const a = await svc.create(T1, actor(), base);
    await expect(
      svc.exit(T1, actor(), a.id, { exitDate: '2026-03-01' }),
    ).rejects.toMatchObject({
      response: { code: 'EXIT_BEFORE_JOIN' },
    });
    const gone = await svc.exit(T1, actor(), a.id, {
      exitDate: '2026-06-30',
      reason: 'Resigned',
    });
    expect(gone.status).toBe('EXITED');
    expect(db.table('employee')).toHaveLength(1);
    await expect(
      svc.exit(T1, actor(), a.id, { exitDate: '2026-07-01' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await svc.reactivate(T1, actor(), a.id)).status).toBe('ACTIVE');
    expect((await svc.list(T1, { status: 'EXITED' })).total).toBe(0);
  });

  it('searches by name, code and designation', async () => {
    const { svc, base } = setup();
    await svc.create(T1, actor(), base);
    await svc.create(T1, actor(), {
      ...base,
      name: 'Meena',
      designation: 'Cook',
    });
    expect((await svc.list(T1, { search: 'meena' })).total).toBe(1);
    expect((await svc.list(T1, { search: 'cook' })).total).toBe(1);
    expect((await svc.list(T1, { search: 'EMP-0001' })).total).toBe(1);
  });
});

describe('EmployeesService: linking to a login', () => {
  it('creates an employee from a teacher login in one step', async () => {
    const { svc } = setup();
    const e = await svc.createFromUser(T1, actor(), {
      userId: 'u-teacher',
      joinDate: '2026-04-01',
    });
    expect(e.name).toBe('Tara Teacher');
    expect(e.phone).toBe('9000000001');
    expect(e.designation).toBe('Teacher');
    expect(e.userId).toBe('u-teacher');
    expect((await svc.unlinkedStaff(T1)).map((u) => u.id)).not.toContain(
      'u-teacher',
    );
  });

  it('refuses parents, other schools and already linked logins', async () => {
    const { svc } = setup();
    await expect(
      svc.createFromUser(T1, actor(), { userId: 'u-parent' }),
    ).rejects.toMatchObject({ response: { code: 'USER_NOT_STAFF' } });
    await expect(
      svc.createFromUser(T1, actor(), { userId: 'u-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await svc.createFromUser(T1, actor(), { userId: 'u-teacher' });
    await expect(
      svc.createFromUser(T1, actor(), { userId: 'u-teacher' }),
    ).rejects.toMatchObject({ response: { code: 'USER_ALREADY_LINKED' } });
  });

  it('unlinking a login keeps the employee', async () => {
    const { svc } = setup();
    const e = await svc.createFromUser(T1, actor(), { userId: 'u-teacher' });
    const u = await svc.update(T1, actor(), e.id, { userId: null });
    expect(u.userId).toBeNull();
  });
});

describe('EmployeesService: documents', () => {
  it('stores them under the HR key path through the files service only', async () => {
    const { svc, files, base, db } = setup();
    const e = await svc.create(T1, actor(), base);
    files.upload.mockResolvedValue({
      key: `private/${T1}/hr/${e.id}/x.pdf`,
      size: 10,
      contentType: 'application/pdf',
    });
    await svc.uploadDocument(
      T1,
      actor(),
      e.id,
      { originalname: 'offer.pdf', size: 10 } as never,
      'Offer letter',
    );
    expect(files.upload).toHaveBeenCalledWith(
      T1,
      expect.anything(),
      'hr_document',
      e.id,
    );
    expect(db.table('employeeDocument')[0].fileKey).toBe(
      `private/${T1}/hr/${e.id}/x.pdf`,
    );
    expect(await svc.listDocuments(T1, e.id)).toHaveLength(1);
    await expect(svc.listDocuments(T2, e.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
