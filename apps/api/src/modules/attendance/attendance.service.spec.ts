import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Role } from '@prisma/client';
import { AttendanceService, summarise } from './attendance.service';
import { academicYearRange, isValidYmd, monthRange, todayIn } from './attendance-dates';
import type { ActiveUser } from '../../common/types/active-user.type';

const SCHOOL_A = 'tenant-a';
const SCHOOL_B = 'tenant-b';
const CLASS_ID = '11111111-1111-1111-1111-111111111111';

const user = (id: string, role: Role, tenantId = SCHOOL_A): ActiveUser => ({ id, role, tenantId, name: id, isVerified: true });
const CLASS_TEACHER = user('teacher-ct', Role.teacher);
const SUBJECT_TEACHER = user('teacher-sub', Role.teacher);
const OUTSIDER_TEACHER = user('teacher-x', Role.teacher);
const ADMIN = user('admin-1', Role.admin);
const PARENT = user('parent-1', Role.parent);
const OTHER_PARENT = user('parent-2', Role.parent);

function makePrisma() {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }) },
    class: { findFirst: jest.fn(), findMany: jest.fn() },
    student: { findMany: jest.fn(), findUnique: jest.fn() },
    studentParent: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    schoolHoliday: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    attendanceRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: typeof prisma) => unknown)(prisma) : Promise.all(arg as unknown[]),
  );
  return prisma;
}

/** Class with a flagged class teacher, plus a subject teacher who is assigned but not the class teacher. */
const classWithClassTeacher = {
  id: CLASS_ID,
  name: 'Class 5',
  section: 'A',
  teachers: [
    { teacherId: CLASS_TEACHER.id, isClassTeacher: true },
    { teacherId: SUBJECT_TEACHER.id, isClassTeacher: false },
  ],
};
const classWithoutClassTeacher = { ...classWithClassTeacher, teachers: [{ teacherId: SUBJECT_TEACHER.id, isClassTeacher: false }] };

const students = [
  { id: 's1', name: 'Avyaan Singha', rollNo: '2', class: { name: 'Class 5', section: 'A' } },
  { id: 's2', name: 'Aadhya Nair', rollNo: '10', class: { name: 'Class 5', section: 'A' } },
];

describe('AttendanceService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let notifications: { send: jest.Mock };
  let service: AttendanceService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T06:30:00.000Z')); // 12:00 IST on 08/10/2026
    prisma = makePrisma();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new AttendanceService(prisma as never, notifications as never);
    prisma.class.findFirst.mockResolvedValue(classWithClassTeacher);
    prisma.student.findMany.mockImplementation(({ where }: { where: { id?: { in: string[] } } }) =>
      Promise.resolve(where.id ? students.filter((st) => where.id!.in.includes(st.id)) : students),
    );
  });

  afterEach(() => jest.useRealTimers());

  const submit = (by: ActiveUser, date: string, entries: { studentId: string; status: AttendanceStatus }[]) =>
    service.submit(by.tenantId, { classId: CLASS_ID, date, entries }, by);

  describe('who can mark', () => {
    it('lets the class teacher mark today', async () => {
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }]);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(1);
    });

    it('blocks an assigned subject teacher when the class has a class teacher', async () => {
      await expect(submit(SUBJECT_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets any assigned teacher mark when no class teacher is flagged', async () => {
      prisma.class.findFirst.mockResolvedValue(classWithoutClassTeacher);
      await submit(SUBJECT_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }]);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
    });

    it('blocks teachers not assigned to the class, and parents', async () => {
      prisma.class.findFirst.mockResolvedValue(classWithoutClassTeacher);
      await expect(submit(OUTSIDER_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        ForbiddenException,
      );
      await expect(submit(PARENT, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('edit window', () => {
    it("stops teachers editing a previous day's attendance", async () => {
      await expect(submit(CLASS_TEACHER, '2026-10-07', [{ studentId: 's1', status: AttendanceStatus.absent }])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('treats "today" in the school timezone: 23:59 IST is still today, 00:01 IST is tomorrow', async () => {
      jest.setSystemTime(new Date('2026-10-08T18:29:00.000Z')); // 23:59 IST, 08/10
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }]);

      jest.setSystemTime(new Date('2026-10-08T18:31:00.000Z')); // 00:01 IST, 09/10
      await expect(submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets admins correct past days but nobody can mark the future', async () => {
      await submit(ADMIN, '2026-09-30', [{ studentId: 's1', status: AttendanceStatus.leave }]);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
      await expect(submit(ADMIN, '2026-10-09', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses to mark a school holiday', async () => {
      prisma.schoolHoliday.findUnique.mockResolvedValue({ name: 'Dussehra' });
      await expect(submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.present }])).rejects.toThrow(
        /holiday \(Dussehra\)/,
      );
    });

    it('rejects students who are not in the class', async () => {
      prisma.student.findMany.mockResolvedValue([students[0]]);
      await expect(
        submit(CLASS_TEACHER, '2026-10-08', [
          { studentId: 's1', status: AttendanceStatus.present },
          { studentId: 'someone-else', status: AttendanceStatus.present },
        ]),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('roster', () => {
    it('orders by roll number numerically, then students without one by name, and reports edit rights', async () => {
      prisma.student.findMany.mockResolvedValue([
        { id: 'b', name: 'Zara', rollNo: null },
        { id: 'c', name: 'Om', rollNo: '10' },
        { id: 'd', name: 'Aarav', rollNo: null },
        { id: 'e', name: 'Ira', rollNo: '2' },
      ]);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { studentId: 'c', status: AttendanceStatus.absent, note: null, markedAt: new Date(), updatedAt: new Date() },
      ]);

      const roster = await service.getRoster(SCHOOL_A, CLASS_ID, undefined, CLASS_TEACHER);

      expect(roster.students.map((st) => st.name)).toEqual(['Ira', 'Om', 'Aarav', 'Zara']);
      expect(roster.students[1].status).toBe('absent');
      expect(roster).toMatchObject({ date: '2026-10-08', submitted: true, canEdit: true });

      const yesterday = await service.getRoster(SCHOOL_A, CLASS_ID, '2026-10-07', CLASS_TEACHER);
      expect(yesterday.canEdit).toBe(false);
    });

    it('lets assigned subject teachers view but not edit', async () => {
      const roster = await service.getRoster(SCHOOL_A, CLASS_ID, '2026-10-08', SUBJECT_TEACHER);
      expect(roster.canEdit).toBe(false);
      await expect(service.getRoster(SCHOOL_A, CLASS_ID, '2026-10-08', OUTSIDER_TEACHER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('audit log', () => {
    it('logs every change with from/to statuses', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { studentId: 's1', status: AttendanceStatus.present, note: null, absenceAlertSent: false },
        { studentId: 's2', status: AttendanceStatus.present, note: null, absenceAlertSent: false },
      ]);

      await submit(CLASS_TEACHER, '2026-10-08', [
        { studentId: 's1', status: AttendanceStatus.absent },
        { studentId: 's2', status: AttendanceStatus.present },
      ]);

      expect(prisma.attendanceRecord.upsert).toHaveBeenCalledTimes(1); // s2 unchanged
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: SCHOOL_A,
          actorId: CLASS_TEACHER.id,
          action: 'attendance.update',
          diff: expect.objectContaining({ date: '2026-10-08', changes: [{ studentId: 's1', from: 'present', to: 'absent' }] }),
        }),
      });
    });
  });

  describe('absence alerts', () => {
    beforeEach(() => {
      prisma.studentParent.findMany.mockResolvedValue([{ studentId: 's1', parentId: PARENT.id }]);
    });

    it('pushes "marked absent today" to the parents once', async () => {
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.absent }]);

      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: SCHOOL_A,
          userId: PARENT.id,
          body: 'Avyaan was marked absent today (08/10/2026).',
          data: { type: 'attendance', studentId: 's1', date: '2026-10-08', status: 'absent' },
        }),
      );
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ studentId: { in: ['s1'] } }), data: { absenceAlertSent: true } }),
      );
    });

    it('does not re-send when the child is already absent and alerted', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { studentId: 's1', status: AttendanceStatus.absent, note: null, absenceAlertSent: true },
      ]);
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.absent }]);
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('sends a correction when an alerted child is changed back', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { studentId: 's1', status: AttendanceStatus.absent, note: null, absenceAlertSent: true },
      ]);
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.late }]);

      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({ body: 'Correction: Avyaan was marked late today (08/10/2026).' }),
      );
      expect(prisma.attendanceRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { absenceAlertSent: false } }),
      );
    });

    it('sends nothing for back-dated admin corrections', async () => {
      await submit(ADMIN, '2026-10-01', [{ studentId: 's1', status: AttendanceStatus.absent }]);
      expect(notifications.send).not.toHaveBeenCalled();
    });
  });

  describe('student summary access', () => {
    beforeEach(() => {
      prisma.student.findUnique.mockResolvedValue({
        id: 's1',
        name: 'Avyaan Singha',
        classId: CLASS_ID,
        class: { name: 'Class 5', section: 'A', academicYear: '2026-27', teachers: [{ teacherId: CLASS_TEACHER.id }] },
      });
    });

    it("lets a parent see their own child's attendance", async () => {
      prisma.studentParent.findFirst.mockResolvedValue({ studentId: 's1' });
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { date: new Date('2026-10-01T00:00:00Z'), status: AttendanceStatus.present, note: null },
        { date: new Date('2026-10-05T00:00:00Z'), status: AttendanceStatus.absent, note: null },
      ]);

      const result = await service.getStudentSummary(SCHOOL_A, 's1', '2026-10', PARENT);

      expect(prisma.studentParent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1', parentId: PARENT.id, student: { tenantId: SCHOOL_A } } }),
      );
      expect(result.monthSummary).toMatchObject({ daysMarked: 2, daysPresent: 1, percentage: 50 });
      expect(result.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-05']);
    });

    it("refuses another parent's child", async () => {
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(service.getStudentSummary(SCHOOL_A, 's1', '2026-10', OTHER_PARENT)).rejects.toThrow(ForbiddenException);
    });

    it('refuses teachers who do not teach the class', async () => {
      await expect(service.getStudentSummary(SCHOOL_A, 's1', '2026-10', OUTSIDER_TEACHER)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('two schools are isolated', () => {
    it("can't reach a class from another school, even as that school's admin", async () => {
      // School B's admin asks for school A's class id: the lookup is scoped to school B, so it's not found.
      prisma.class.findFirst.mockImplementation(({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(where.tenantId === SCHOOL_A && where.id === CLASS_ID ? classWithClassTeacher : null),
      );
      const adminB = user('admin-b', Role.admin, SCHOOL_B);

      await expect(service.getRoster(SCHOOL_B, CLASS_ID, '2026-10-08', adminB)).rejects.toThrow(NotFoundException);
      await expect(submit(adminB, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.absent }])).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
    });

    it('scopes every read and write to the caller school', async () => {
      prisma.class.findMany.mockResolvedValue([]);
      await submit(CLASS_TEACHER, '2026-10-08', [{ studentId: 's1', status: AttendanceStatus.absent }]);
      await service.getSchoolSummary(SCHOOL_A, '2026-10-08');
      await service.getReport(SCHOOL_A, { from: '2026-10-01', to: '2026-10-08' });

      const calls = [
        ...prisma.class.findFirst.mock.calls,
        ...prisma.class.findMany.mock.calls,
        ...prisma.student.findMany.mock.calls,
        ...prisma.attendanceRecord.findMany.mock.calls,
        ...prisma.attendanceRecord.groupBy.mock.calls,
        ...prisma.attendanceRecord.updateMany.mock.calls,
      ];
      expect(calls.length).toBeGreaterThan(0);
      for (const [args] of calls) expect(args.where.tenantId).toBe(SCHOOL_A);
      for (const [args] of prisma.attendanceRecord.upsert.mock.calls) {
        expect(args.where.tenantId_studentId_date.tenantId).toBe(SCHOOL_A);
        expect(args.create.tenantId).toBe(SCHOOL_A);
      }
    });
  });

  describe('school summary', () => {
    it('counts present (incl. late) per class and lists classes not yet marked', async () => {
      prisma.class.findMany.mockResolvedValue([
        { id: 'c1', name: 'Class 1', section: 'A', _count: { students: 3 } },
        { id: 'c2', name: 'Class 2', section: 'A', _count: { students: 2 } },
      ]);
      prisma.attendanceRecord.groupBy.mockResolvedValue([
        { classId: 'c1', status: AttendanceStatus.present, _count: { _all: 2 } },
        { classId: 'c1', status: AttendanceStatus.late, _count: { _all: 1 } },
      ]);

      const result = await service.getSchoolSummary(SCHOOL_A, '2026-10-08');

      expect(result).toMatchObject({ totalStudents: 5, daysPresent: 3, daysMarked: 3, percentage: 100 });
      expect(result.notMarked).toEqual([{ classId: 'c2', name: 'Class 2', section: 'A' }]);
    });
  });
});

describe('attendance helpers', () => {
  it('summarise counts late as present and leave as a marked day', () => {
    expect(summarise({ present: 18, late: 2, absent: 1, leave: 1 })).toMatchObject({ daysMarked: 22, daysPresent: 20, percentage: 90.9 });
    expect(summarise({ present: 0, late: 0, absent: 0, leave: 0 }).percentage).toBeNull();
  });

  it('date helpers', () => {
    expect(todayIn('Asia/Kolkata', new Date('2026-10-08T18:31:00.000Z'))).toBe('2026-10-09');
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(academicYearRange('2026-27')).toEqual({ from: '2026-04-01', to: '2027-03-31' });
  });
});
