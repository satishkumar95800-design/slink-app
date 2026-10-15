import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RemarksService } from './remarks.service';

const teacher = {
  id: 'teacher-1',
  tenantId: 't1',
  role: Role.teacher,
  name: 'T',
  isVerified: true,
};

function setup() {
  const prisma = {
    student: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Aarav Sharma',
        classId: 'c1',
        class: { name: 'Class 5', academicYear: '2026-27' },
      }),
    },
    classTeacher: { findFirst: jest.fn().mockResolvedValue({ classId: 'c1' }) },
    attendanceRecord: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'present', _count: { _all: 45 } },
        { status: 'late', _count: { _all: 3 } },
        { status: 'absent', _count: { _all: 2 } },
      ]),
    },
    report: {
      findMany: jest.fn().mockResolvedValue([
        {
          term: 'Term 1',
          content: { grades: { Maths: 'A+', English: 'B' } },
        },
      ]),
    },
    studentNote: {
      groupBy: jest.fn().mockResolvedValue([
        { type: 'complaint', _count: { _all: 2 } },
        { type: 'note', _count: { _all: 5 } },
      ]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ preferredLanguage: 'kn' }),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ defaultLanguage: 'en' }),
    },
  };
  const ai = {
    complete: jest.fn().mockResolvedValue('  Aarav is doing well.  '),
  };
  return {
    prisma,
    ai,
    service: new RemarksService(prisma as never, ai as never),
  };
}

describe('RemarksService', () => {
  it("drafts in the teacher's language from attendance, grades, note counts and points", async () => {
    const { ai, service } = setup();
    const out = await service.draft('t1', teacher, {
      studentId: 's1',
      points: 'Loves reading',
    });

    expect(out).toEqual({ remark: 'Aarav is doing well.', language: 'kn' });
    const [[req]] = ai.complete.mock.calls as [
      [{ content: string; tier: string }],
    ];
    expect(req.tier).toBe('smart');
    expect(req.content).toContain('Write the remark in Kannada');
    expect(req.content).toContain('Child: Aarav, Class 5');
    expect(req.content).toContain(
      'Attendance: 96% of 50 school days (late 3 times)',
    );
    expect(req.content).toContain('Grades (Term 1): Maths A+, English B');
    expect(req.content).toContain('2 complaint');
    expect(req.content).toContain('Loves reading');
    // Plain notes aren't mentioned, and no surname is sent.
    expect(req.content).not.toContain('5 note');
    expect(req.content).not.toContain('Sharma');
  });

  it('uses the language asked for', async () => {
    const { service } = setup();
    expect(
      (await service.draft('t1', teacher, { studentId: 's1', language: 'hi' }))
        .language,
    ).toBe('hi');
  });

  it("refuses a teacher who doesn't teach the student's class", async () => {
    const { prisma, ai, service } = setup();
    prisma.classTeacher.findFirst.mockResolvedValue(null);
    await expect(
      service.draft('t1', teacher, { studentId: 's1' }),
    ).rejects.toThrow(ForbiddenException);
    expect(ai.complete).not.toHaveBeenCalled();
  });
});
