import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { GuardianRelation, ImportStatus, Prisma, Role } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkbookParserService } from './workbook-parser.service';
import { validateClassesTab } from './validators/classes.validator';
import { validateUsersTab } from './validators/users.validator';
import { validateStudentsTab } from './validators/students.validator';
import { validateFeeStructuresTab } from './validators/fee-structures.validator';
import { classKey, normalizedName } from './validators/shared';
import {
  CommitResult,
  CreatedUserCredential,
  EntitySummary,
  ImportIssue,
  ImportJobQueuePayload,
  ImportJobStatusResponse,
  ImportSummary,
  ImportTabName,
  ParsedTab,
  TabReport,
  TabValidation,
  ValidationReport,
  ValidClassRow,
  ValidFeeStructureRow,
  ValidStudentRow,
  ValidUserRow,
} from './types';

const BCRYPT_ROUNDS = 12;
/** Beyond this, a request-lifetime transaction risks timing out — the queue takes over */
const SYNC_ROW_LIMIT = 200;
/** Generous headroom for a ~200-row interactive transaction; default Prisma timeout (5s) is too tight for bulk writes */
const TRANSACTION_TIMEOUT_MS = 30_000;
const IMPORTS_QUEUE = 'imports';
const COMMIT_JOB = 'commit';

interface RunValidationResult {
  report: ValidationReport;
  classes: TabValidation<ValidClassRow>;
  users: TabValidation<ValidUserRow>;
  students: TabValidation<ValidStudentRow>;
  feeStructures: TabValidation<ValidFeeStructureRow>;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly parser: WorkbookParserService,
    private readonly prisma: PrismaService,
    @InjectQueue(IMPORTS_QUEUE)
    private readonly importsQueue: Queue<ImportJobQueuePayload>,
  ) {}

  async validate(buffer: Buffer): Promise<ValidationReport> {
    const { report } = await this.runValidation(buffer);
    return report;
  }

  /**
   * Re-parses and re-validates the same file (validate/commit are stateless — the
   * client re-uploads rather than referencing a cached result). Files within the
   * sync row limit are written immediately in one transaction; larger files are
   * handed to the "imports" queue and the caller polls GET /imports/:jobId.
   */
  async commit(
    tenantId: string,
    actorId: string,
    fileName: string,
    buffer: Buffer,
  ): Promise<CommitResult> {
    const { report, classes, users, students, feeStructures } =
      await this.runValidation(buffer);

    if (report.totalErrors > 0) {
      throw new UnprocessableEntityException(report);
    }

    const totalRows =
      classes.validRows.length +
      users.validRows.length +
      students.validRows.length +
      feeStructures.validRows.length;

    if (totalRows > SYNC_ROW_LIMIT) {
      const importJob = await this.prisma.importJob.create({
        data: {
          tenantId,
          initiatedBy: actorId,
          fileName,
          status: ImportStatus.pending,
        },
      });
      await this.importsQueue.add(COMMIT_JOB, {
        importJobId: importJob.id,
        tenantId,
        fileBase64: buffer.toString('base64'),
      });
      return { importJobId: importJob.id, status: 'pending' };
    }

    const importJob = await this.prisma.importJob.create({
      data: {
        tenantId,
        initiatedBy: actorId,
        fileName,
        status: ImportStatus.processing,
      },
    });

    try {
      const summary = await this.runCommitTransaction(
        tenantId,
        classes,
        users,
        students,
        feeStructures,
      );
      await this.markCompleted(importJob.id, summary);
      return { importJobId: importJob.id, status: 'completed', summary };
    } catch (err) {
      await this.markFailed(importJob.id, err);
      throw err;
    }
  }

  /** Invoked only by the "imports" queue processor — writes are identical to the sync path. */
  async processQueuedJob(
    importJobId: string,
    tenantId: string,
    buffer: Buffer,
  ): Promise<void> {
    const { report, classes, users, students, feeStructures } =
      await this.runValidation(buffer);

    if (report.totalErrors > 0) {
      await this.prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: ImportStatus.failed,
          errorReport: report as unknown as Prisma.InputJsonObject,
          completedAt: new Date(),
        },
      });
      return;
    }

    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: { status: ImportStatus.processing },
    });

    try {
      const summary = await this.runCommitTransaction(
        tenantId,
        classes,
        users,
        students,
        feeStructures,
      );
      await this.markCompleted(importJobId, summary);
    } catch (err) {
      await this.markFailed(importJobId, err);
      throw err;
    }
  }

  async getJobStatus(
    tenantId: string,
    jobId: string,
  ): Promise<ImportJobStatusResponse> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Import job not found');

    return {
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      summary: (job.summary as unknown as ImportSummary) ?? null,
      errorReport: job.errorReport,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  private async markCompleted(importJobId: string, summary: ImportSummary) {
    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.completed,
        summary: summary as unknown as Prisma.InputJsonObject,
        completedAt: new Date(),
      },
    });
  }

  private async markFailed(importJobId: string, err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown error during import';
    await this.prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: ImportStatus.failed,
        errorReport: { message },
        completedAt: new Date(),
      },
    });
  }

  private async runCommitTransaction(
    tenantId: string,
    classes: TabValidation<ValidClassRow>,
    users: TabValidation<ValidUserRow>,
    students: TabValidation<ValidStudentRow>,
    feeStructures: TabValidation<ValidFeeStructureRow>,
  ): Promise<ImportSummary> {
    return this.prisma.$transaction(
      async (tx) => {
        const {
          emailToId,
          summary: usersSummary,
          credentials,
        } = await this.commitUsers(tx, tenantId, users.validRows);
        const { classKeyToId, summary: classesSummary } =
          await this.commitClasses(tx, tenantId, classes.validRows, emailToId);
        const feeStructuresSummary = await this.commitFeeStructures(
          tx,
          tenantId,
          feeStructures.validRows,
          classKeyToId,
        );
        const studentsSummary = await this.commitStudents(
          tx,
          tenantId,
          students.validRows,
          classKeyToId,
        );

        return {
          classes: classesSummary,
          users: usersSummary,
          students: studentsSummary,
          feeStructures: feeStructuresSummary,
          createdUserCredentials: credentials,
        } satisfies ImportSummary;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  // ─── Shared parse + validate ─────────────────────────────────────────────────

  private async runValidation(buffer: Buffer): Promise<RunValidationResult> {
    const workbook = await this.parser.parse(buffer);

    const classes = validateClassesTab(workbook.classes);
    const classNames = new Set(
      classes.validRows.map((cls) => normalizedName(cls.name)),
    );

    const users = validateUsersTab(workbook.users, classNames);
    const students = validateStudentsTab(workbook.students, classes.validRows);
    const feeStructures = validateFeeStructuresTab(
      workbook.feeStructures,
      classes.validRows,
    );

    const classTeacherWarnings = this.checkClassTeacherEmails(
      classes.validRows,
      users.validRows,
    );

    const tabs: TabReport[] = [
      this.toTabReport('Classes', workbook.classes, classes.errors, [
        ...classes.warnings,
        ...classTeacherWarnings,
      ]),
      this.toTabReport('Users', workbook.users, users.errors, users.warnings),
      this.toTabReport(
        'Students',
        workbook.students,
        students.errors,
        students.warnings,
      ),
      this.toTabReport(
        'Fee Structures',
        workbook.feeStructures,
        feeStructures.errors,
        feeStructures.warnings,
      ),
    ];

    const totalErrors = tabs.reduce((sum, t) => sum + t.errors.length, 0);
    const totalWarnings = tabs.reduce((sum, t) => sum + t.warnings.length, 0);

    return {
      report: {
        tabs,
        totalErrors,
        totalWarnings,
        canImport: totalErrors === 0,
      },
      classes,
      users,
      students,
      feeStructures,
    };
  }

  private toTabReport(
    tab: ImportTabName,
    parsed: ParsedTab,
    errors: ImportIssue[],
    warnings: ImportIssue[],
  ): TabReport {
    const extraColumnWarnings: ImportIssue[] = parsed.extraColumns.map(
      (column) => ({
        tab,
        row: 1,
        column,
        reason: `Unrecognized column "${column}" — ignored`,
      }),
    );
    return {
      tab,
      rowCount: parsed.rows.length,
      errors,
      warnings: [...extraColumnWarnings, ...warnings],
    };
  }

  /** Classes."Class Teacher Email" must match a Users-tab row with Role=teacher — warning only, per spec 4b.3 */
  private checkClassTeacherEmails(
    classes: ValidClassRow[],
    users: ValidUserRow[],
  ): ImportIssue[] {
    const teacherEmails = new Set(
      users
        .filter((user) => user.role === 'teacher')
        .map((user) => user.email.trim().toLowerCase()),
    );

    const warnings: ImportIssue[] = [];
    for (const cls of classes) {
      if (!cls.classTeacherEmail) continue;
      if (!teacherEmails.has(cls.classTeacherEmail.trim().toLowerCase())) {
        warnings.push({
          tab: 'Classes',
          row: cls.row,
          column: 'Class Teacher Email',
          reason: `"${cls.classTeacherEmail}" does not match any teacher in the Users tab — teacher can be added later`,
        });
      }
    }
    return warnings;
  }

  // ─── Commit: Users tab ────────────────────────────────────────────────────────

  private async commitUsers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rows: ValidUserRow[],
  ) {
    const emailToId = new Map<string, string>();
    const credentials: CreatedUserCredential[] = [];
    const summary: EntitySummary = { created: 0, updated: 0 };

    for (const row of rows) {
      const emailKey = row.email.trim().toLowerCase();
      const existing = await tx.user.findUnique({
        where: { tenantId_email: { tenantId, email: row.email } },
      });

      if (existing) {
        await tx.user.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            phone: row.phone ?? existing.phone,
            role: row.role,
          },
        });
        emailToId.set(emailKey, existing.id);
        summary.updated++;
      } else {
        const temporaryPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(
          temporaryPassword,
          BCRYPT_ROUNDS,
        );
        const created = await tx.user.create({
          data: {
            tenantId,
            name: row.name,
            email: row.email,
            phone: row.phone ?? null,
            role: row.role,
            passwordHash,
            isVerified: true,
          },
        });
        emailToId.set(emailKey, created.id);
        credentials.push({ email: row.email, temporaryPassword });
        summary.created++;
      }
    }

    return { emailToId, summary, credentials };
  }

  // ─── Commit: Classes tab ──────────────────────────────────────────────────────

  private async commitClasses(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rows: ValidClassRow[],
    emailToId: Map<string, string>,
  ) {
    const classKeyToId = new Map<
      string,
      { id: string; academicYear: string }
    >();
    const summary: EntitySummary = { created: 0, updated: 0 };

    for (const row of rows) {
      const teacherId = row.classTeacherEmail
        ? emailToId.get(row.classTeacherEmail.trim().toLowerCase())
        : undefined;
      const existing = await tx.class.findFirst({
        where: {
          tenantId,
          name: row.name,
          section: row.section,
          academicYear: row.academicYear,
        },
      });

      let classId: string;
      if (existing) {
        await tx.class.update({
          where: { id: existing.id },
          data: { teacherId: teacherId ?? existing.teacherId },
        });
        classId = existing.id;
        summary.updated++;
      } else {
        const created = await tx.class.create({
          data: {
            tenantId,
            name: row.name,
            section: row.section,
            academicYear: row.academicYear,
            teacherId: teacherId ?? null,
          },
        });
        classId = created.id;
        summary.created++;
      }

      classKeyToId.set(classKey(row.name, row.section, row.academicYear), {
        id: classId,
        academicYear: row.academicYear,
      });
    }

    return { classKeyToId, summary };
  }

  // ─── Commit: Fee Structures tab ───────────────────────────────────────────────

  private async commitFeeStructures(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rows: ValidFeeStructureRow[],
    classKeyToId: Map<string, { id: string; academicYear: string }>,
  ) {
    const summary: EntitySummary = { created: 0, updated: 0 };
    const groups = new Map<string, ValidFeeStructureRow[]>();
    for (const row of rows) {
      const key = `${row.classKey}|${row.term.trim().toLowerCase()}`;
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const [first] = group;
      const classInfo = classKeyToId.get(first.classKey);
      if (!classInfo) continue; // resolved during validation; a miss here would indicate a bug upstream

      const totalAmount = group.reduce((sum, r) => sum + r.amount, 0);
      const items = group.map((r) => ({
        label: r.feeComponent,
        amount: new Prisma.Decimal(r.amount.toFixed(2)),
      }));
      const dueDate = new Date(first.dueDate);
      const lateFeePerDay = first.lateFee ?? 0;

      const existing = await tx.feeStructure.findFirst({
        where: {
          tenantId,
          classId: classInfo.id,
          name: first.term,
          academicYear: classInfo.academicYear,
        },
      });

      if (existing) {
        await tx.feeItem.deleteMany({ where: { feeStructureId: existing.id } });
        await tx.feeStructure.update({
          where: { id: existing.id },
          data: {
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
            dueDate,
            lateFeePerDay,
            items: { create: items },
          },
        });
        summary.updated++;
      } else {
        await tx.feeStructure.create({
          data: {
            tenantId,
            classId: classInfo.id,
            name: first.term,
            academicYear: classInfo.academicYear,
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
            dueDate,
            lateFeePerDay,
            items: { create: items },
          },
        });
        summary.created++;
      }
    }

    return summary;
  }

  // ─── Commit: Students tab ─────────────────────────────────────────────────────

  private async commitStudents(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rows: ValidStudentRow[],
    classKeyToId: Map<string, { id: string }>,
  ) {
    const summary: EntitySummary = { created: 0, updated: 0 };

    for (const row of rows) {
      const classInfo = classKeyToId.get(row.classKey);
      if (!classInfo) continue; // resolved during validation; a miss here would indicate a bug upstream

      const existing = await tx.student.findUnique({
        where: {
          tenantId_admissionNo: { tenantId, admissionNo: row.admissionNo },
        },
      });

      let studentId: string;
      if (existing) {
        await tx.student.update({
          where: { id: existing.id },
          data: {
            name: row.name,
            classId: classInfo.id,
            dob: row.dob ? new Date(row.dob) : existing.dob,
          },
        });
        studentId = existing.id;
        summary.updated++;
      } else {
        const created = await tx.student.create({
          data: {
            tenantId,
            name: row.name,
            admissionNo: row.admissionNo,
            classId: classInfo.id,
            dob: row.dob ? new Date(row.dob) : null,
          },
        });
        studentId = created.id;
        summary.created++;
      }

      let parent = await tx.user.findUnique({
        where: { tenantId_phone: { tenantId, phone: row.parentPhone } },
      });
      if (!parent) {
        parent = await tx.user.create({
          data: {
            tenantId,
            phone: row.parentPhone,
            email: row.parentEmail ?? null,
            name: row.parentName,
            role: Role.parent,
            isVerified: false,
          },
        });
      }

      const existingLink = await tx.studentParent.findUnique({
        where: { studentId_parentId: { studentId, parentId: parent.id } },
      });
      if (!existingLink) {
        await tx.studentParent.create({
          data: {
            studentId,
            parentId: parent.id,
            relation: GuardianRelation.guardian,
            isPrimary: true,
          },
        });
      }
    }

    return summary;
  }
}

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url');
}
