import { UnprocessableEntityException } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { WorkbookParserService } from './workbook-parser.service';
import { buildFixtureWorkbook } from './test-fixtures';
import type { PrismaService } from '../../prisma/prisma.service';
import type { Queue } from 'bull';
import type { ImportJobQueuePayload } from './types';

type CreateArgs = { data: Record<string, unknown> };
type UpdateArgs = {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
};

function makeMockTx() {
  return {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    class: {
      findFirst: jest.fn(),
      create: jest.fn<Promise<{ id: string }>, [CreateArgs]>(),
      update: jest.fn(),
    },
    classTeacher: {
      upsert: jest.fn(),
    },
    feeStructure: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn<Promise<{ id: string }>, [CreateArgs]>(),
      update: jest.fn(),
    },
    feeItem: {
      findFirst: jest.fn(),
      findMany: jest.fn<Promise<Array<{ amount: unknown }>>, [unknown]>().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    student: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    studentParent: { findUnique: jest.fn(), create: jest.fn() },
  };
}

function makeMockPrisma(tx: ReturnType<typeof makeMockTx>) {
  return {
    importJob: {
      create: jest
        .fn<Promise<{ id: string }>, [CreateArgs]>()
        .mockResolvedValue({ id: 'job-1' }),
      update: jest.fn<Promise<unknown>, [UpdateArgs]>().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(
      (callback: (tx: ReturnType<typeof makeMockTx>) => unknown) =>
        callback(tx),
    ),
  };
}

function makeMockQueue() {
  return {
    add: jest
      .fn<Promise<unknown>, [string, ImportJobQueuePayload]>()
      .mockResolvedValue({}),
  };
}

describe('ImportsService.validate', () => {
  let service: ImportsService;

  beforeEach(() => {
    service = new ImportsService(
      new WorkbookParserService(),
      {} as never,
      makeMockQueue() as unknown as Queue<ImportJobQueuePayload>,
    );
  });

  it('reports zero errors for a fully valid workbook and can import', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': 'jane@school.edu',
        },
      ],
      Users: [
        { 'Full Name': 'Jane Doe', Email: 'jane@school.edu', Role: 'teacher' },
      ],
      Students: [
        {
          'Student Name': 'Amy',
          'Admission Number': 'A1',
          'Class Name': 'Grade 5',
          Section: 'A',
          'Parent Name': 'Bob',
          'Parent Mobile Number': '+919876543210',
        },
      ],
      'Fee Structures': [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          Term: 'Term 1',
          'Fee Component': 'Tuition',
          Amount: 10000,
          'Due Date': '2025-06-01',
        },
      ],
    });

    const report = await service.validate(buffer);

    expect(report.canImport).toBe(true);
    expect(report.totalErrors).toBe(0);
    expect(report.tabs.find((t) => t.tab === 'Classes')?.rowCount).toBe(1);
    expect(report.tabs.find((t) => t.tab === 'Students')?.rowCount).toBe(1);
  });

  it('aggregates errors across tabs and blocks import', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': 'bad-year' },
      ],
      Students: [
        {
          'Student Name': 'Amy',
          'Admission Number': 'A1',
          'Class Name': 'Grade 5',
          Section: 'A',
          'Parent Name': 'Bob',
          'Parent Mobile Number': 'not-e164',
        },
      ],
    });

    const report = await service.validate(buffer);

    expect(report.canImport).toBe(false);
    expect(report.totalErrors).toBeGreaterThan(0);
    const classesTab = report.tabs.find((t) => t.tab === 'Classes');
    const studentsTab = report.tabs.find((t) => t.tab === 'Students');
    expect(classesTab?.errors.length).toBeGreaterThan(0);
    // Since Grade 5/A never resolves as a valid class, the reference error should surface too
    expect(studentsTab?.errors.length).toBeGreaterThan(0);
  });

  it('warns when a Class Teacher Email does not match any teacher in the Users tab', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': 'ghost@school.edu',
        },
      ],
    });

    const report = await service.validate(buffer);
    const classesTab = report.tabs.find((t) => t.tab === 'Classes');
    expect(
      classesTab?.warnings.some((w) =>
        w.reason.includes('does not match any teacher'),
      ),
    ).toBe(true);
  });

  it('reports an empty-but-valid workbook with zero rows and no errors', async () => {
    const buffer = await buildFixtureWorkbook({});
    const report = await service.validate(buffer);

    expect(report.canImport).toBe(true);
    expect(report.tabs.every((t) => t.rowCount === 0)).toBe(true);
  });
});

describe('ImportsService.commit', () => {
  const TENANT = 'tenant-uuid';
  const ACTOR = 'actor-uuid';

  let mockTx: ReturnType<typeof makeMockTx>;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let mockQueue: ReturnType<typeof makeMockQueue>;
  let service: ImportsService;

  beforeEach(() => {
    mockTx = makeMockTx();
    mockPrisma = makeMockPrisma(mockTx);
    mockQueue = makeMockQueue();
    service = new ImportsService(
      new WorkbookParserService(),
      mockPrisma as unknown as PrismaService,
      mockQueue as unknown as Queue<ImportJobQueuePayload>,
    );
  });

  it('creates a new class, teacher, student, parent, and fee structure end-to-end', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': 'jane@school.edu',
        },
      ],
      Users: [
        { 'Full Name': 'Jane Doe', Email: 'jane@school.edu', Role: 'teacher' },
      ],
      Students: [
        {
          'Student Name': 'Amy',
          'Admission Number': 'A1',
          'Class Name': 'Grade 5',
          Section: 'A',
          'Parent Name': 'Bob',
          'Parent Mobile Number': '+919876543210',
        },
      ],
      'Fee Structures': [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          Term: 'Term 1',
          'Fee Component': 'Tuition',
          Amount: 10000,
          'Due Date': '2025-06-01',
        },
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          Term: 'Term 1',
          'Fee Component': 'Transport',
          Amount: 2000,
          'Due Date': '2025-06-01',
        },
      ],
    });

    mockTx.user.findUnique.mockResolvedValue(null); // no existing teacher, no existing parent
    mockTx.user.create
      .mockResolvedValueOnce({ id: 'teacher-1' }) // teacher created
      .mockResolvedValueOnce({ id: 'parent-1' }); // parent created
    mockTx.class.findFirst.mockResolvedValue(null);
    mockTx.class.create.mockResolvedValue({ id: 'class-1' });
    mockTx.classTeacher.upsert.mockResolvedValue({});
    mockTx.feeStructure.findUnique.mockResolvedValue(null);
    mockTx.feeStructure.create.mockResolvedValue({ id: 'fs-1' });
    mockTx.student.findUnique.mockResolvedValue(null);
    mockTx.student.create.mockResolvedValue({ id: 'student-1' });
    mockTx.studentParent.findUnique.mockResolvedValue(null);

    const result = await service.commit(
      TENANT,
      ACTOR,
      'onboarding.xlsx',
      buffer,
    );

    expect(result.importJobId).toBe('job-1');
    expect(result.status).toBe('completed');
    expect(result.summary!.classes).toEqual({ created: 1, updated: 0 });
    expect(result.summary!.users).toEqual({ created: 1, updated: 0 });
    expect(result.summary!.students).toEqual({ created: 1, updated: 0 });
    expect(result.summary!.feeStructures).toEqual({ created: 1, updated: 0 });
    expect(result.summary!.createdUserCredentials).toHaveLength(1);
    expect(result.summary!.createdUserCredentials[0].email).toBe(
      'jane@school.edu',
    );
    expect(mockQueue.add).not.toHaveBeenCalled();

    // Class gets the teacher's resolved id via the ClassTeacher join — added
    // as a co-teacher (upsert), never replacing an existing assignment
    expect(mockTx.classTeacher.upsert).toHaveBeenCalledWith({
      where: { classId_teacherId: { classId: 'class-1', teacherId: 'teacher-1' } },
      create: { classId: 'class-1', teacherId: 'teacher-1', isClassTeacher: true },
      update: { isClassTeacher: true },
    });

    // Fee structure groups both components into one structure with a summed total,
    // linked to its class and named uniquely per-class (plan names are now
    // unique tenant-wide since a plan can span multiple classes)
    const feeStructureCreateArgs = mockTx.feeStructure.create.mock.calls[0][0];
    expect(feeStructureCreateArgs.data.classes).toEqual({ create: [{ classId: 'class-1' }] });
    expect(feeStructureCreateArgs.data.name).toBe('Term 1 — Grade 5 A');
    const items = feeStructureCreateArgs.data.items as {
      create: Array<{ label: string }>;
    };
    expect(items.create.map((item) => item.label)).toEqual([
      'Tuition',
      'Transport',
    ]);

    const importJobUpdateArgs = mockPrisma.importJob.update.mock.calls[0][0];
    expect(importJobUpdateArgs.where).toEqual({ id: 'job-1' });
    expect(importJobUpdateArgs.data.status).toBe('completed');
  });

  it('updates existing records instead of duplicating them on re-import', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
      Students: [
        {
          'Student Name': 'Amy',
          'Admission Number': 'A1',
          'Class Name': 'Grade 5',
          Section: 'A',
          'Parent Name': 'Bob',
          'Parent Mobile Number': '+919876543210',
        },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue({
      id: 'class-1',
    });
    mockTx.class.update.mockResolvedValue({});
    mockTx.student.findUnique.mockResolvedValue({ id: 'student-1', dob: null });
    mockTx.student.update.mockResolvedValue({});
    mockTx.user.findUnique.mockResolvedValue({ id: 'parent-1' }); // existing parent
    mockTx.studentParent.findUnique.mockResolvedValue({
      studentId: 'student-1',
      parentId: 'parent-1',
    }); // already linked

    const result = await service.commit(
      TENANT,
      ACTOR,
      'onboarding.xlsx',
      buffer,
    );

    expect(result.summary!.classes).toEqual({ created: 0, updated: 1 });
    expect(result.summary!.students).toEqual({ created: 0, updated: 1 });
    expect(mockTx.user.create).not.toHaveBeenCalled();
    expect(mockTx.studentParent.create).not.toHaveBeenCalled();
  });

  it('adds a co-teacher to an existing class without removing whoever is already assigned', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          'Academic Year': '2025-26',
          'Class Teacher Email': 'newteacher@school.edu',
        },
      ],
      Users: [
        {
          'Full Name': 'New Teacher',
          Email: 'newteacher@school.edu',
          Role: 'teacher',
        },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue({ id: 'class-1' });
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({ id: 'teacher-2' });
    mockTx.classTeacher.upsert.mockResolvedValue({});

    await service.commit(TENANT, ACTOR, 'onboarding.xlsx', buffer);

    // Additive upsert, not deleteMany+create — an existing co-teacher (not
    // touched by this mock) would survive a real transaction untouched.
    expect(mockTx.classTeacher.upsert).toHaveBeenCalledWith({
      where: { classId_teacherId: { classId: 'class-1', teacherId: 'teacher-2' } },
      create: { classId: 'class-1', teacherId: 'teacher-2', isClassTeacher: true },
      update: { isClassTeacher: true },
    });
  });

  it('merges fee items into an existing fee structure instead of deleting components missing from this file', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
      'Fee Structures': [
        {
          'Class Name': 'Grade 5',
          Section: 'A',
          Term: 'Term 1',
          'Fee Component': 'Transport',
          Amount: 3500,
          'Due Date': '2025-06-01',
        },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue({ id: 'class-1' });
    mockTx.class.update.mockResolvedValue({});
    mockTx.feeStructure.findUnique.mockResolvedValue({ id: 'fs-1' });
    // "Transport" already exists on this plan (e.g. from a prior import) — this
    // file only re-states its new amount, and must not wipe "Tuition" alongside it.
    mockTx.feeItem.findFirst.mockResolvedValue({ id: 'item-transport', amount: 3000 });
    mockTx.feeItem.findMany.mockResolvedValue([
      { amount: 3500 }, // Transport, just updated
      { amount: 25000 }, // Tuition, pre-existing, untouched by this import
    ]);

    await service.commit(TENANT, ACTOR, 'onboarding.xlsx', buffer);

    expect(mockTx.feeItem.create).not.toHaveBeenCalled();
    const itemUpdateArgs = mockTx.feeItem.update.mock.calls[0][0] as {
      where: { id: string };
      data: { amount: { toString(): string } };
    };
    expect(itemUpdateArgs.where).toEqual({ id: 'item-transport' });
    expect(itemUpdateArgs.data.amount.toString()).toBe('3500');

    const updateArgs = mockTx.feeStructure.update.mock.calls[0][0] as UpdateArgs;
    // Total reflects both the updated Transport item and the untouched Tuition item.
    expect(String(updateArgs.data.totalAmount)).toBe('28500');
  });

  it('throws UnprocessableEntityException and never opens a transaction when validation fails', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': 'bad-year' },
      ],
    });

    await expect(
      service.commit(TENANT, ACTOR, 'bad.xlsx', buffer),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mockPrisma.importJob.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it('enqueues an async job instead of running a transaction when the file exceeds the sync row limit', async () => {
    const students = Array.from({ length: 201 }, (_, i) => ({
      'Student Name': `Student ${i}`,
      'Admission Number': `A${i}`,
      'Class Name': 'Grade 5',
      Section: 'A',
      'Parent Name': 'Parent',
      'Parent Mobile Number': `+9198765${String(i).padStart(5, '0')}`,
    }));
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
      Students: students,
    });

    const result = await service.commit(TENANT, ACTOR, 'huge.xlsx', buffer);

    expect(result.importJobId).toBe('job-1');
    expect(result.status).toBe('pending');
    expect(result.summary).toBeUndefined();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    const importJobCreateArgs = mockPrisma.importJob.create.mock.calls[0][0];
    expect(importJobCreateArgs.data.status).toBe('pending');

    expect(mockQueue.add).toHaveBeenCalledWith(
      'commit',
      expect.objectContaining({ importJobId: 'job-1', tenantId: TENANT }),
    );
  });

  it('marks the import job failed and rethrows when the transaction throws', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue(null);
    mockTx.class.create.mockRejectedValue(
      new Error('unique constraint violation'),
    );

    await expect(
      service.commit(TENANT, ACTOR, 'onboarding.xlsx', buffer),
    ).rejects.toThrow('unique constraint violation');

    const importJobUpdateArgs = mockPrisma.importJob.update.mock.calls[0][0];
    expect(importJobUpdateArgs.where).toEqual({ id: 'job-1' });
    expect(importJobUpdateArgs.data.status).toBe('failed');
    expect(importJobUpdateArgs.data.errorReport).toEqual({
      message: 'unique constraint violation',
    });
  });
});

describe('ImportsService.processQueuedJob', () => {
  const TENANT = 'tenant-uuid';
  const JOB_ID = 'job-1';

  let mockTx: ReturnType<typeof makeMockTx>;
  let mockPrisma: ReturnType<typeof makeMockPrisma>;
  let service: ImportsService;

  beforeEach(() => {
    mockTx = makeMockTx();
    mockPrisma = makeMockPrisma(mockTx);
    service = new ImportsService(
      new WorkbookParserService(),
      mockPrisma as unknown as PrismaService,
      makeMockQueue() as unknown as Queue<ImportJobQueuePayload>,
    );
  });

  it('writes the file and marks the job completed', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue(null);
    mockTx.class.create.mockResolvedValue({ id: 'class-1' });

    await service.processQueuedJob(JOB_ID, TENANT, buffer);

    const updateCalls = mockPrisma.importJob.update.mock.calls;
    const finalCall = updateCalls[updateCalls.length - 1][0];
    expect(finalCall.where).toEqual({ id: JOB_ID });
    expect(finalCall.data.status).toBe('completed');
  });

  it('marks the job failed without throwing when validation fails', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': 'bad-year' },
      ],
    });

    await service.processQueuedJob(JOB_ID, TENANT, buffer);

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    const updateArgs = mockPrisma.importJob.update.mock.calls[0][0];
    expect(updateArgs.data.status).toBe('failed');
  });

  it('marks the job failed and rethrows when the transaction throws', async () => {
    const buffer = await buildFixtureWorkbook({
      Classes: [
        { 'Class Name': 'Grade 5', Section: 'A', 'Academic Year': '2025-26' },
      ],
    });

    mockTx.class.findFirst.mockResolvedValue(null);
    mockTx.class.create.mockRejectedValue(new Error('boom'));

    await expect(
      service.processQueuedJob(JOB_ID, TENANT, buffer),
    ).rejects.toThrow('boom');

    const updateCalls = mockPrisma.importJob.update.mock.calls;
    const finalCall = updateCalls[updateCalls.length - 1][0];
    expect(finalCall.data.status).toBe('failed');
  });
});

describe('ImportsService.getJobStatus', () => {
  it('returns the job when found for the tenant', async () => {
    const mockPrisma = {
      importJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'job-1',
          status: 'completed',
          fileName: 'onboarding.xlsx',
          summary: { classes: { created: 1, updated: 0 } },
          errorReport: null,
          createdAt: new Date('2026-01-01'),
          completedAt: new Date('2026-01-01'),
        }),
      },
    };
    const service = new ImportsService(
      new WorkbookParserService(),
      mockPrisma as unknown as PrismaService,
      makeMockQueue() as unknown as Queue<ImportJobQueuePayload>,
    );

    const result = await service.getJobStatus('tenant-uuid', 'job-1');
    expect(result.id).toBe('job-1');
    expect(result.status).toBe('completed');
  });

  it('throws NotFoundException when the job does not exist for the tenant', async () => {
    const mockPrisma = {
      importJob: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ImportsService(
      new WorkbookParserService(),
      mockPrisma as unknown as PrismaService,
      makeMockQueue() as unknown as Queue<ImportJobQueuePayload>,
    );

    await expect(
      service.getJobStatus('tenant-uuid', 'missing'),
    ).rejects.toThrow('Import job not found');
  });
});
