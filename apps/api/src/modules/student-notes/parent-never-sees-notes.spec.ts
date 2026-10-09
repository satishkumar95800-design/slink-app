import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import type { ActiveUser } from '../../common/types/active-user.type';
import { StudentNotesController } from './student-notes.controller';
import { StudentsService } from '../students/students.service';
import { ParentService } from '../parent/parent.service';

/**
 * Student notes (MOM, complaints, parent discussions) are internal-only
 * (docs/SPEC-improvements.md ground rules + §4.4). These tests fail if any
 * parent-reachable code path starts touching or returning them.
 */

const PARENT: ActiveUser = {
  id: 'parent-1',
  tenantId: 'tenant-a',
  role: Role.parent,
  name: 'P',
  isVerified: true,
};

/** Wraps a mock Prisma client so any use of the studentNote model, or a "notes" include/select, fails the test. */
function tripwire<T extends object>(mock: T): T {
  const seen: unknown[] = [];
  const proxy = new Proxy(mock, {
    get(target, prop) {
      if (prop === 'studentNote')
        throw new Error('Parent code path touched prisma.studentNote');
      const value = (target as Record<string | symbol, unknown>)[prop];
      if (value && typeof value === 'object') {
        return new Proxy(value as object, {
          get(model, method) {
            const fn = (model as Record<string | symbol, unknown>)[method];
            if (typeof fn !== 'function') return fn;
            return (...args: unknown[]) => {
              seen.push(args);
              if (JSON.stringify(args).includes('"notes"'))
                throw new Error(
                  `Parent query asked for notes: ${JSON.stringify(args)}`,
                );
              return (fn as (...a: unknown[]) => unknown).apply(model, args);
            };
          },
        });
      }
      return value;
    },
  });
  return proxy;
}

function hasNotesKey(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasNotesKey);
  return Object.entries(value).some(
    ([k, v]) => k === 'notes' || k === 'studentNotes' || hasNotesKey(v),
  );
}

const student = {
  id: 's1',
  tenantId: 'tenant-a',
  name: 'Avyaan Singha',
  admissionNo: 'A1',
  classId: 'class-1',
  class: { id: 'class-1', name: 'Class 1', academicYear: '2026-27' },
  transportSlab: null,
  parents: [
    {
      relation: 'father',
      isPrimary: true,
      parent: { id: PARENT.id, name: 'P', phone: '+91', profession: null },
    },
  ],
  customFieldValues: [],
};

describe('Parents never receive student notes', () => {
  it('the tripwire itself catches a notes lookup or include', () => {
    const guarded = tripwire({
      studentNote: {},
      student: { findMany: () => [] },
    } as Record<string, unknown>) as {
      studentNote: unknown;
      student: { findMany: (args: unknown) => unknown };
    };
    expect(() => guarded.studentNote).toThrow(/studentNote/);
    expect(() =>
      guarded.student.findMany({ include: { notes: true } }),
    ).toThrow(/asked for notes/);
    expect(() =>
      guarded.student.findMany({ include: { class: true } }),
    ).not.toThrow();
  });

  it('every student-notes endpoint excludes the parent role', () => {
    const reflector = new Reflector();
    const handlers = Object.getOwnPropertyNames(
      StudentNotesController.prototype,
    ).filter((m) => m !== 'constructor');
    expect(handlers.length).toBeGreaterThan(0);
    for (const name of handlers) {
      const roles = reflector.get<Role[]>(
        ROLES_KEY,
        StudentNotesController.prototype[
          name as keyof StudentNotesController
        ] as never,
      );
      expect({ name, roles }).toEqual({
        name,
        roles: expect.not.arrayContaining([Role.parent]),
      });
      expect(roles?.length ?? 0).toBeGreaterThan(0); // an un-annotated route would be open to every role
    }
  });

  it('student endpoints a parent can call never load or return notes', async () => {
    const prisma = tripwire({
      student: {
        findMany: jest.fn().mockResolvedValue([student]),
        findUnique: jest.fn().mockResolvedValue(student),
        count: jest.fn().mockResolvedValue(1),
      },
      studentParent: {
        findMany: jest.fn().mockResolvedValue([{ student }]),
        findUnique: jest
          .fn()
          .mockResolvedValue({ studentId: 's1', parentId: PARENT.id }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ studentId: 's1', parentId: PARENT.id }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    });
    const students = new StudentsService(prisma as never);

    const responses = [
      await students.findMyChildren('tenant-a', PARENT.id),
      await students.findAll('tenant-a', PARENT, {}),
      await students.findOne('tenant-a', 's1', PARENT),
    ];
    for (const r of responses) expect(hasNotesKey(r)).toBe(false);
  });

  it('the parent home and notices endpoints never touch notes', async () => {
    const prisma = tripwire({
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
      },
      studentParent: {
        findFirst: jest.fn().mockResolvedValue({
          student: {
            ...student,
            class: { id: 'class-1', name: 'Class 1', section: 'A' },
          },
        }),
      },
      studentFee: { findMany: jest.fn().mockResolvedValue([]) },
      paymentClaim: { findMany: jest.fn().mockResolvedValue([]) },
      report: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });
    const parent = new ParentService(
      prisma as never,
      { homeworkAttachmentUrls: jest.fn() } as never,
      { signAttachments: jest.fn() } as never,
    );

    expect(hasNotesKey(await parent.getHome('tenant-a', 's1', PARENT))).toBe(
      false,
    );
    expect(hasNotesKey(await parent.getNotices('tenant-a', 's1', PARENT))).toBe(
      false,
    );
  });
});
