/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- in-memory Prisma fake */
import { Role } from '@prisma/client';
import type { ActiveUser } from '../../common/types/active-user.type';
import { SyllabusService } from './syllabus.service';

const TENANT = 'tenant-a';
const C5A = '00000000-0000-4000-8000-0000000000a1';
const C5B = '00000000-0000-4000-8000-0000000000a2';
const SCI = '00000000-0000-4000-8000-0000000000b1';
const TEACHER = 'teacher-1';
const OTHER_TEACHER = 'teacher-2';
const PARENT = 'parent-1';
const CHILD = 'student-1';
const user = (role: Role, id: string): ActiveUser => ({
  id,
  role,
  tenantId: TENANT,
  name: id,
  isVerified: true,
});
const ADMIN = user(Role.admin, 'admin-1');

type Row = Record<string, any>;

/** Equality, { in }, { not: null } and OR, which is all the service asks for. */
const matches = (row: Row, where: Row = {}): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (v === undefined) return true;
    if (k === 'OR') return (v as Row[]).some((w) => matches(row, w));
    if (k === 'student') return true;
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('in' in v) return v.in.includes(row[k]);
      if ('not' in v) return row[k] !== v.not;
    }
    return row[k] === v;
  });

function setup() {
  let seq = 0;
  const topics: Row[] = [];
  const audit: Row[] = [];
  const assignments = [
    {
      tenantId: TENANT,
      teacherId: TEACHER,
      classId: C5A,
      subjectId: SCI,
      id: 'ts1',
    },
  ];
  const classes = [
    {
      id: C5A,
      tenantId: TENANT,
      name: 'Class 5',
      section: 'A',
      academicYear: '2026-27',
    },
    {
      id: C5B,
      tenantId: TENANT,
      name: 'Class 5',
      section: 'B',
      academicYear: '2026-27',
    },
  ];
  const subjects = [{ id: SCI, tenantId: TENANT, name: 'Science' }];
  const table = (rows: Row[]) => ({
    findMany: jest.fn(({ where }: Row = {}) =>
      Promise.resolve(rows.filter((r) => matches(r, where))),
    ),
    findFirst: jest.fn(({ where }: Row) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    ),
  });
  const prisma: Row = {
    $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(prisma)),
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    class: table(classes),
    subject: table(subjects),
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: TEACHER, name: 'Krishna' }]),
    },
    teacherSubject: {
      findMany: jest.fn(({ where }: Row) =>
        Promise.resolve(
          assignments
            .filter((a) => matches(a, where))
            .map((a) => ({
              ...a,
              teacher: { id: a.teacherId, name: 'Krishna' },
            })),
        ),
      ),
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(assignments.find((a) => matches(a, where)) ?? null),
      ),
    },
    studentParent: {
      findFirst: jest.fn(({ where }: Row) =>
        Promise.resolve(
          where.studentId === CHILD && where.parentId === PARENT
            ? {
                student: {
                  id: CHILD,
                  name: 'Aarav',
                  classId: C5A,
                  class: classes[0],
                },
              }
            : null,
        ),
      ),
    },
    syllabusTopic: {
      ...table(topics),
      findMany: jest.fn(({ where, include }: Row = {}) =>
        Promise.resolve(
          topics
            .filter((r) => matches(r, where))
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((r) => (include ? { ...r, subject: subjects[0] } : r)),
        ),
      ),
      create: jest.fn(({ data }: Row) => {
        const row = {
          id: `t${++seq}`,
          completedOn: null,
          completedBy: null,
          createdAt: new Date(),
          ...data,
        };
        topics.push(row);
        return Promise.resolve(row);
      }),
      createMany: jest.fn(({ data }: Row) => {
        for (const d of data)
          topics.push({
            id: `t${++seq}`,
            completedOn: null,
            completedBy: null,
            createdAt: new Date(),
            ...d,
          });
        return Promise.resolve({ count: data.length });
      }),
      update: jest.fn(({ where, data }: Row) => {
        const row = topics.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      deleteMany: jest.fn(({ where }: Row) => {
        const gone = topics.filter((r) => matches(r, where));
        for (const g of gone) topics.splice(topics.indexOf(g), 1);
        return Promise.resolve({ count: gone.length });
      }),
      groupBy: jest.fn(({ where }: Row) => {
        const counts = new Map<string, Row>();
        for (const r of topics.filter((x) => matches(x, where))) {
          const key = `${r.classId}:${r.subjectId}`;
          const c = counts.get(key) ?? {
            classId: r.classId,
            subjectId: r.subjectId,
            _count: { _all: 0 },
          };
          c._count._all++;
          counts.set(key, c);
        }
        return Promise.resolve([...counts.values()]);
      }),
    },
    auditLog: {
      create: jest.fn(
        ({ data }: Row) => (audit.push(data), Promise.resolve(data)),
      ),
    },
  };
  const service = new SyllabusService(prisma as never);
  const plan = (topicsIn: Row[]) =>
    service.savePlan(TENANT, ADMIN, C5A, SCI, { topics: topicsIn as never });
  return { service, topics, audit, plan };
}

beforeAll(() => {
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2026-10-17T06:00:00Z'));
});
afterAll(() => jest.useRealTimers());

describe('SyllabusService', () => {
  it('saves a plan in order and keeps covered dates of topics sent back with their id', async () => {
    const { service, plan, audit } = setup();
    const first = await plan([
      { title: 'Parts of a plant', unit: 'Plants', plannedBy: '2026-10-01' },
      { title: 'Photosynthesis', unit: 'Plants', plannedBy: '2026-10-30' },
    ]);
    await service.complete(
      TENANT,
      user(Role.teacher, TEACHER),
      first.topics[0].id,
      '2026-10-02',
    );
    const again = await plan([
      {
        id: first.topics[0].id,
        title: 'Parts of a plant',
        unit: 'Plants',
        plannedBy: '2026-10-01',
      },
      { title: 'Seeds', plannedBy: '2026-11-15' },
    ]);
    expect(again.topics.map((t) => t.title)).toEqual([
      'Parts of a plant',
      'Seeds',
    ]);
    expect(again.topics[0].completedOn).toBe('2026-10-02');
    expect(again.status).toBe('on_time');
    expect(audit.map((a) => a.action)).toEqual([
      'syllabus.plan.save',
      'syllabus.topic.complete',
      'syllabus.plan.save',
    ]);
  });

  it('refuses a topic id from another plan', async () => {
    const { plan } = setup();
    await expect(
      plan([
        {
          id: '00000000-0000-4000-8000-00000000ffff',
          title: 'X',
          plannedBy: '2026-10-01',
        },
      ]),
    ).rejects.toMatchObject({ response: { code: 'TOPIC_NOT_FOUND' } });
  });

  it('lets only the subject teacher (or an admin) mark a topic, and never in the future', async () => {
    const { service, plan } = setup();
    const p = await plan([{ title: 'Seeds', plannedBy: '2026-10-01' }]);
    const id = p.topics[0].id;
    await expect(
      service.complete(TENANT, user(Role.teacher, OTHER_TEACHER), id),
    ).rejects.toMatchObject({ response: { code: 'NOT_SUBJECT_TEACHER' } });
    await expect(
      service.complete(TENANT, user(Role.teacher, TEACHER), id, '2026-10-18'),
    ).rejects.toMatchObject({ response: { code: 'DATE_IN_FUTURE' } });
    const done = await service.complete(
      TENANT,
      user(Role.teacher, TEACHER),
      id,
    );
    expect(done.topics[0].completedOn).toBe('2026-10-17');
    const undone = await service.undo(TENANT, ADMIN, id);
    expect(undone.topics[0].completedOn).toBeNull();
  });

  it('shows a teacher only their own classes, with late status', async () => {
    const { service, plan } = setup();
    await plan([{ title: 'Seeds', plannedBy: '2026-10-10' }]);
    await service.savePlan(TENANT, ADMIN, C5B, SCI, {
      topics: [{ title: 'Seeds', plannedBy: '2026-12-01' }],
    });
    const mine = await service.overview(TENANT, user(Role.teacher, TEACHER));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      className: 'Class 5 A',
      status: 'late',
      daysLate: 7,
      teachers: [{ id: TEACHER, name: 'Krishna' }],
    });
    const all = await service.overview(TENANT, ADMIN);
    expect(all.map((r) => r.className)).toEqual(['Class 5 A', 'Class 5 B']);
  });

  it('copies a plan to another section without covered dates, and will not overwrite unasked', async () => {
    const { service, plan } = setup();
    const p = await plan([{ title: 'Seeds', plannedBy: '2026-10-01' }]);
    await service.complete(TENANT, ADMIN, p.topics[0].id);
    await service.copyPlan(TENANT, ADMIN, C5A, SCI, { classIds: [C5B] });
    const b = await service.plan(TENANT, ADMIN, C5B, SCI);
    expect(b.topics).toEqual([
      expect.objectContaining({ title: 'Seeds', completedOn: null }),
    ]);
    await expect(
      service.copyPlan(TENANT, ADMIN, C5A, SCI, { classIds: [C5B] }),
    ).rejects.toMatchObject({
      response: { code: 'SYLLABUS_EXISTS', classes: ['Class 5 B'] },
    });
  });

  it("shows parents their own child's coverage only, without target dates", async () => {
    const { service, plan } = setup();
    const p = await plan([
      { title: 'Seeds', plannedBy: '2026-10-01' },
      { title: 'Roots', plannedBy: '2026-10-05' },
    ]);
    await service.complete(TENANT, ADMIN, p.topics[0].id, '2026-10-03');
    const view = await service.child(TENANT, PARENT, CHILD);
    expect(view.subjects).toEqual([
      expect.objectContaining({
        subjectName: 'Science',
        covered: 1,
        total: 2,
        percent: 50,
        lastCoveredOn: '2026-10-03',
      }),
    ]);
    expect(JSON.stringify(view)).not.toMatch(/plannedBy|late|overdue/);
    await expect(
      service.child(TENANT, 'someone-else', CHILD),
    ).rejects.toMatchObject({
      response: { code: 'STUDENT_NOT_FOUND' },
    });
  });
});
