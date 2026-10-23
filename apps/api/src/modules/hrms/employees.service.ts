import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeStatus, EmploymentType, Prisma, Role } from '@prisma/client';
import type { Express } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { FilesService } from '../files/files.service';
import { FileCategory } from '../files/dto/upload-file.dto';
import {
  fromDbDate,
  isValidYmd,
  toDbDate,
} from '../attendance/attendance-dates';
import {
  CreateEmployeeDto,
  EmployeeQueryDto,
  ExitEmployeeDto,
  FromUserDto,
  SENSITIVE_FIELDS,
  SensitiveField,
  UpdateEmployeeDto,
} from './dto/hrms.dto';
import { HrCrypto } from './hr-crypto.service';
import {
  ENC_COLUMN,
  hintFor,
  invalidKey,
  normalizeSensitive,
} from './employee-fields';
import { hrmsStrings as t } from './hrms.strings';
import { Db, audit, fail, todayFor, withLock } from './hrms.shared';

const STAFF_ROLES: Role[] = [
  Role.teacher,
  Role.admin,
  Role.accounts,
  Role.librarian,
  Role.receptionist,
];

const DEFAULT_DESIGNATION: Record<string, string> = {
  teacher: 'Teacher',
  admin: 'Administrator',
  accounts: 'Accounts',
};

const employeeInclude = {
  user: { select: { id: true, name: true, role: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeRow = Prisma.EmployeeGetPayload<{
  include: typeof employeeInclude;
}>;

type SensitiveInput = Partial<Record<SensitiveField, string | undefined>>;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HrCrypto,
    private readonly files: FilesService,
  ) {}

  // ── views ─────────────────────────────────────────────────────────────────

  /** Masked view: ciphertext never leaves the service, only the hints. */
  view(e: EmployeeRow) {
    const hints = (e.sensitiveHints ?? {}) as Record<string, string>;
    const masked: Record<SensitiveField, string | null> = {
      pan: null,
      aadhaar: null,
      uan: null,
      esiNumber: null,
      bankAccount: null,
      bankIfsc: null,
      bankHolder: null,
    };
    for (const f of SENSITIVE_FIELDS) {
      masked[f] = e[ENC_COLUMN[f]] ? (hints[f] ?? 'XXXX') : null;
    }
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.name,
      phone: e.phone,
      email: e.email,
      designation: e.designation,
      department: e.department,
      employmentType: e.employmentType,
      joinDate: fromDbDate(e.joinDate),
      exitDate: e.exitDate ? fromDbDate(e.exitDate) : null,
      exitReason: e.exitReason,
      status: e.status,
      userId: e.userId,
      user: e.user,
      masked,
      hasBankDetails: !!(e.bankAccountEnc && e.bankIfscEnc),
    };
  }

  // ── directory ─────────────────────────────────────────────────────────────

  async list(tenantId: string, q: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      tenantId,
      ...(q.status && { status: q.status }),
      ...(q.employmentType && { employmentType: q.employmentType }),
      ...(q.department && {
        department: { equals: q.department, mode: 'insensitive' },
      }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { employeeCode: { contains: q.search, mode: 'insensitive' } },
          { phone: { contains: q.search } },
          { designation: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };
    const page = q.page ?? 1;
    const limit = q.limit ?? 25;
    const [total, rows] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map((r) => this.view(r)), total, page, limit };
  }

  async departments(tenantId: string) {
    const rows = await this.prisma.employee.findMany({
      where: { tenantId, department: { not: null } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    return rows.map((r) => r.department as string);
  }

  async get(tenantId: string, id: string) {
    return this.view(await this.load(this.prisma, tenantId, id));
  }

  async load(db: Db, tenantId: string, id: string): Promise<EmployeeRow> {
    const row = await db.employee.findFirst({
      where: { id, tenantId },
      include: employeeInclude,
    });
    if (!row) throw new NotFoundException(t.employeeNotFound);
    return row;
  }

  // ── create / update ───────────────────────────────────────────────────────

  async create(tenantId: string, user: ActiveUser, dto: CreateEmployeeDto) {
    if (!isValidYmd(dto.joinDate))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const sensitive = this.sensitiveData(dto);
    const created = await withLock(
      this.prisma,
      tenantId,
      'employees',
      async (tx) => {
        if (dto.userId)
          await this.assertLinkable(tx, tenantId, dto.userId, null);
        const code = dto.employeeCode ?? (await this.nextCode(tx, tenantId));
        await this.assertCodeFree(tx, tenantId, code, null);
        const row = await tx.employee.create({
          data: {
            tenantId,
            userId: dto.userId ?? null,
            employeeCode: code,
            name: dto.name,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            designation: dto.designation,
            department: dto.department ?? null,
            employmentType: dto.employmentType ?? EmploymentType.PERMANENT,
            joinDate: toDbDate(dto.joinDate),
            createdBy: user.id,
            ...sensitive.data,
            sensitiveHints: sensitive.hints,
          },
          include: employeeInclude,
        });
        await audit(
          tx,
          tenantId,
          user.id,
          'hrms.employee.create',
          'employee',
          row.id,
          {
            employeeCode: code,
            linkedUserId: dto.userId ?? null,
            sensitiveFieldsSet: Object.keys(sensitive.hints),
          },
        );
        return row;
      },
    );
    return this.view(created);
  }

  /** One-click: an employee record from an existing teacher, admin or accounts login. */
  async createFromUser(tenantId: string, user: ActiveUser, dto: FromUserDto) {
    const joinDate = dto.joinDate ?? (await todayFor(this.prisma, tenantId));
    if (!isValidYmd(joinDate))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const created = await withLock(
      this.prisma,
      tenantId,
      'employees',
      async (tx) => {
        const login = await this.assertLinkable(tx, tenantId, dto.userId, null);
        const code = await this.nextCode(tx, tenantId);
        const row = await tx.employee.create({
          data: {
            tenantId,
            userId: login.id,
            employeeCode: code,
            name: login.name,
            phone: login.phone,
            email: login.email,
            designation:
              dto.designation ?? DEFAULT_DESIGNATION[login.role] ?? 'Staff',
            department: dto.department ?? null,
            employmentType: dto.employmentType ?? EmploymentType.PERMANENT,
            joinDate: toDbDate(joinDate),
            createdBy: user.id,
          },
          include: employeeInclude,
        });
        await audit(
          tx,
          tenantId,
          user.id,
          'hrms.employee.create',
          'employee',
          row.id,
          {
            employeeCode: code,
            linkedUserId: login.id,
            fromUser: true,
          },
        );
        return row;
      },
    );
    return this.view(created);
  }

  async update(
    tenantId: string,
    user: ActiveUser,
    id: string,
    dto: UpdateEmployeeDto,
  ) {
    const updated = await withLock(
      this.prisma,
      tenantId,
      'employees',
      async (tx) => {
        const current = await this.load(tx, tenantId, id);
        const data: Prisma.EmployeeUncheckedUpdateInput = {};
        const changed: string[] = [];

        if (dto.joinDate !== undefined) {
          if (!isValidYmd(dto.joinDate))
            fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
          if (current.exitDate && dto.joinDate > fromDbDate(current.exitDate))
            fail(BadRequestException, 'EXIT_BEFORE_JOIN', t.exitBeforeJoin);
          data.joinDate = toDbDate(dto.joinDate);
          changed.push('joinDate');
        }
        const simple = ['name', 'designation', 'employmentType'] as const;
        for (const k of simple) {
          if (dto[k] !== undefined && dto[k] !== current[k]) {
            (data as Record<string, unknown>)[k] = dto[k];
            changed.push(k);
          }
        }
        for (const k of ['phone', 'email', 'department'] as const) {
          if (dto[k] !== undefined) {
            const next = dto[k] === '' ? null : dto[k];
            if (next !== current[k]) {
              data[k] = next;
              changed.push(k);
            }
          }
        }
        if (
          dto.employeeCode !== undefined &&
          dto.employeeCode !== current.employeeCode
        ) {
          await this.assertCodeFree(tx, tenantId, dto.employeeCode, id);
          data.employeeCode = dto.employeeCode;
          changed.push('employeeCode');
        }
        if (dto.userId !== undefined && dto.userId !== current.userId) {
          if (dto.userId !== null)
            await this.assertLinkable(tx, tenantId, dto.userId, id);
          data.userId = dto.userId;
          changed.push('userId');
        }

        // Sensitive fields: encrypted, hints refreshed, names (never values) audited.
        const sensitive = this.sensitiveData(dto);
        const hints = {
          ...((current.sensitiveHints ?? {}) as Record<string, string>),
        };
        Object.assign(data, sensitive.data);
        Object.assign(hints, sensitive.hints);
        const sensitiveChanged = Object.keys(sensitive.hints);
        for (const f of dto.clear ?? []) {
          (data as Record<string, unknown>)[ENC_COLUMN[f]] = null;
          delete hints[f];
          sensitiveChanged.push(f);
        }
        if (sensitiveChanged.length) data.sensitiveHints = hints;

        if (changed.length === 0 && sensitiveChanged.length === 0)
          return current;
        const row = await tx.employee.update({
          where: { id },
          data,
          include: employeeInclude,
        });
        await audit(
          tx,
          tenantId,
          user.id,
          'hrms.employee.update',
          'employee',
          id,
          {
            changed,
            sensitiveFieldsChanged: sensitiveChanged,
          },
        );
        return row;
      },
    );
    return this.view(updated);
  }

  /** Employees are never deleted: an exit keeps history, payslips and audit intact. */
  async exit(
    tenantId: string,
    user: ActiveUser,
    id: string,
    dto: ExitEmployeeDto,
  ) {
    if (!isValidYmd(dto.exitDate))
      fail(BadRequestException, 'INVALID_DATE', t.invalidDate);
    const current = await this.load(this.prisma, tenantId, id);
    if (current.status === EmployeeStatus.EXITED)
      fail(ConflictException, 'ALREADY_EXITED', t.alreadyExited);
    if (dto.exitDate < fromDbDate(current.joinDate))
      fail(BadRequestException, 'EXIT_BEFORE_JOIN', t.exitBeforeJoin);
    const row = await this.prisma.employee.update({
      where: { id },
      data: {
        status: EmployeeStatus.EXITED,
        exitDate: toDbDate(dto.exitDate),
        exitReason: dto.reason ?? null,
      },
      include: employeeInclude,
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.employee.exit',
      'employee',
      id,
      {
        exitDate: dto.exitDate,
        reason: dto.reason ?? null,
      },
    );
    return this.view(row);
  }

  async reactivate(tenantId: string, user: ActiveUser, id: string) {
    const current = await this.load(this.prisma, tenantId, id);
    if (current.status !== EmployeeStatus.EXITED)
      fail(ConflictException, 'NOT_EXITED', t.notExited);
    const row = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.ACTIVE, exitDate: null, exitReason: null },
      include: employeeInclude,
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.employee.reactivate',
      'employee',
      id,
      {},
    );
    return this.view(row);
  }

  /** Staff logins that have no employee record yet (for the one-click create). */
  async unlinkedStaff(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, role: { in: STAFF_ROLES }, employee: null },
      select: { id: true, name: true, phone: true, role: true },
      orderBy: { name: 'asc' },
    });
    return users;
  }

  // ── sensitive reveal ──────────────────────────────────────────────────────

  /** Full values for admin/accounts on an explicit request; every call is audit-logged (field names only). */
  async reveal(
    tenantId: string,
    user: ActiveUser,
    id: string,
    fields?: SensitiveField[],
  ) {
    const e = await this.load(this.prisma, tenantId, id);
    const wanted = fields ?? [...SENSITIVE_FIELDS];
    const values: Partial<Record<SensitiveField, string>> = {};
    for (const f of wanted) {
      const stored = e[ENC_COLUMN[f]];
      if (stored) values[f] = this.crypto.decrypt(stored);
    }
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.employee.reveal',
      'employee',
      id,
      {
        fields: wanted.filter((f) => values[f] !== undefined),
      },
    );
    return { employeeId: id, values };
  }

  // ── documents ─────────────────────────────────────────────────────────────

  async listDocuments(tenantId: string, employeeId: string) {
    await this.load(this.prisma, tenantId, employeeId);
    const rows = await this.prisma.employeeDocument.findMany({
      where: { tenantId, employeeId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((d) => ({
      id: d.id,
      label: d.label,
      fileName: d.fileName,
      contentType: d.contentType,
      size: d.size,
      uploadedAt: d.createdAt.toISOString(),
    }));
  }

  async uploadDocument(
    tenantId: string,
    user: ActiveUser,
    employeeId: string,
    file: Express.Multer.File,
    label: string,
  ) {
    await this.load(this.prisma, tenantId, employeeId);
    const res = await this.files.upload(
      tenantId,
      file,
      FileCategory.HR_DOCUMENT,
      employeeId,
    );
    const row = await this.prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId,
        label,
        fileKey: res.key,
        fileName: file.originalname.slice(0, 200),
        contentType: res.contentType,
        size: res.size,
        uploadedBy: user.id,
      },
    });
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.document.upload',
      'employee_document',
      row.id,
      {
        employeeId,
        label,
        size: res.size,
      },
    );
    return {
      id: row.id,
      label: row.label,
      fileName: row.fileName,
      contentType: row.contentType,
      size: row.size,
      uploadedAt: row.createdAt.toISOString(),
    };
  }

  async documentUrl(
    tenantId: string,
    user: ActiveUser,
    employeeId: string,
    docId: string,
  ) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId, tenantId },
    });
    if (!doc) throw new NotFoundException(t.documentNotFound);
    const url = await this.files.getSignedUrl(doc.fileKey, tenantId);
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.document.view',
      'employee_document',
      docId,
      {
        employeeId,
      },
    );
    return { url };
  }

  async deleteDocument(
    tenantId: string,
    user: ActiveUser,
    employeeId: string,
    docId: string,
  ) {
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId, tenantId },
    });
    if (!doc) throw new NotFoundException(t.documentNotFound);
    await this.prisma.employeeDocument.delete({ where: { id: docId } });
    await this.files.delete(doc.fileKey, tenantId).catch(() => undefined);
    await audit(
      this.prisma,
      tenantId,
      user.id,
      'hrms.document.delete',
      'employee_document',
      docId,
      {
        employeeId,
        label: doc.label,
      },
    );
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Validates, encrypts and masks whichever sensitive fields were provided. */
  sensitiveData(input: SensitiveInput) {
    const data: Record<string, string> = {};
    const hints: Record<string, string> = {};
    for (const f of SENSITIVE_FIELDS) {
      const raw = input[f];
      if (raw === undefined) continue;
      const value = normalizeSensitive(f, raw);
      if (value === null) {
        fail(
          BadRequestException,
          `INVALID_${f.toUpperCase()}`,
          t[invalidKey(f) as keyof typeof t],
        );
      }
      data[ENC_COLUMN[f]] = this.crypto.encrypt(value as string);
      hints[f] = hintFor(f, value as string);
    }
    return { data, hints };
  }

  private async assertCodeFree(
    db: Db,
    tenantId: string,
    code: string,
    exceptId: string | null,
  ) {
    const clash = await db.employee.findFirst({
      where: {
        tenantId,
        employeeCode: { equals: code, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) fail(ConflictException, 'CODE_TAKEN', t.employeeCodeTaken);
  }

  /** Next EMP-0001 style code; called under the employees advisory lock. */
  private async nextCode(db: Db, tenantId: string): Promise<string> {
    const rows = await db.employee.findMany({
      where: { tenantId, employeeCode: { startsWith: 'EMP-' } },
      select: { employeeCode: true },
    });
    const max = rows.reduce((m, r) => {
      const n = Number(/^EMP-(\d+)$/.exec(r.employeeCode)?.[1] ?? 0);
      return Math.max(m, n);
    }, 0);
    return `EMP-${String(max + 1).padStart(4, '0')}`;
  }

  /** The login must be a staff user of this school with no employee record yet. */
  async assertLinkable(
    db: Db,
    tenantId: string,
    userId: string,
    exceptEmployeeId: string | null,
  ) {
    const login = await db.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, name: true, phone: true, email: true, role: true },
    });
    if (!login) fail(NotFoundException, 'USER_NOT_FOUND', t.userNotFound);
    if (!STAFF_ROLES.includes(login!.role))
      fail(BadRequestException, 'USER_NOT_STAFF', t.userNotStaff);
    const taken = await db.employee.findFirst({
      where: {
        userId,
        ...(exceptEmployeeId && { id: { not: exceptEmployeeId } }),
      },
      select: { id: true },
    });
    if (taken)
      fail(ConflictException, 'USER_ALREADY_LINKED', t.userAlreadyLinked);
    return login!;
  }
}
