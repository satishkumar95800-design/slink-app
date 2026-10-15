import { Role } from '@prisma/client';
import { AssistantService } from './assistant.service';
import { PARENT_TOOLS, STAFF_TOOLS, toolsFor } from './tools';

const CLASS_7 = '11111111-1111-4111-8111-111111111111';
const CHILD_A = '22222222-2222-4222-8222-222222222222';
const CHILD_B = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';

function setup(role: Role, pick: Record<string, unknown>) {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    class: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: CLASS_7, name: 'Class 7', section: 'A' }]),
    },
    studentParent: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { student: { id: CHILD_A, name: 'Gauri Singh', classId: CLASS_7 } },
          { student: { id: CHILD_B, name: 'Ananya Singh', classId: CLASS_7 } },
        ]),
    },
    attendanceRecord: {
      groupBy: jest.fn().mockResolvedValue([
        { classId: CLASS_7, status: 'present', _count: { _all: 9 } },
        { classId: CLASS_7, status: 'absent', _count: { _all: 1 } },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const ai = { completeJson: jest.fn().mockResolvedValue(pick) };
  const service = new AssistantService(prisma as never, ai as never);
  const user = { id: 'u1', tenantId: 't1', role, name: 'X', isVerified: true };
  return { prisma, ai, service, user };
}

describe('AssistantService', () => {
  it('runs the chosen query and answers from real data', async () => {
    const { service, user } = setup(Role.admin, {
      tool: 'attendance_by_class',
      args: { from: '2026-10-01', to: '2026-10-15', classId: CLASS_7 },
    });
    const a = await service.ask('t1', user, 'attendance of 7A');
    expect(a.understood.tool).toBe('attendance_by_class');
    expect(a.headline).toEqual({
      key: 'attendance_overall',
      params: { pct: 90, from: '2026-10-01', to: '2026-10-15' },
    });
    expect(a.rows).toEqual([['Class 7 A', 90, 10]]);
  });

  it('sends the model class names and ids, never student data', async () => {
    const { service, user, ai } = setup(Role.admin, { tool: 'none' });
    await service.ask('t1', user, 'anything');
    const [[req]] = ai.completeJson.mock.calls as [
      [{ system: string; content: string }],
    ];
    expect(req.system).toContain(`{"id":"${CLASS_7}","name":"Class 7 A"}`);
    expect(req.system).not.toContain('Singh');
  });

  it("gives parents their children's first names only", async () => {
    const { service, user, ai } = setup(Role.parent, { tool: 'none' });
    await service.ask('t1', user, 'anything');
    const [[req]] = ai.completeJson.mock.calls as [[{ system: string }]];
    expect(req.system).toContain(`{"id":"${CHILD_A}","name":"Gauri"}`);
    expect(req.system).not.toContain('Singh');
  });

  it("refuses a tool outside the user's role and answers 'can't answer'", async () => {
    const { service, user } = setup(Role.accounts, {
      tool: 'absentees_on_date',
      args: {},
    });
    const a = await service.ask('t1', user, 'who was absent');
    expect(a.tool).toBe('none');
    expect(a.headline.key).toBe('cant_answer');
  });

  it("asks which child when a parent's child id isn't theirs or is missing", async () => {
    const { service, user, prisma } = setup(Role.parent, {
      tool: 'child_attendance',
      args: { childId: OTHER },
    });
    const a = await service.ask('t1', user, 'attendance?');
    expect(a.headline).toEqual({
      key: 'which_child',
      params: { names: 'Gauri, Ananya' },
    });
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('accepts an id with extra text and clamps silly arguments', async () => {
    const { service, user, prisma } = setup(Role.parent, {
      tool: 'child_attendance',
      args: {
        childId: `${CHILD_B}: Ananya`,
        from: '1999-01-01',
        to: '2099-01-01',
      },
    });
    const a = await service.ask('t1', user, 'Ananya attendance');
    expect(a.headline.params.name).toBe('Ananya');
    const [[q]] = prisma.attendanceRecord.findMany.mock.calls as [
      [{ where: { studentId: string } }],
    ];
    expect(q.where.studentId).toBe(CHILD_B);
    expect(String(a.headline.params.from) >= '2025').toBe(true);
    expect(String(a.headline.params.to) <= '2027').toBe(true);
  });
});

describe('tool access', () => {
  it('limits accounts to money tools and parents to their own', () => {
    expect(
      toolsFor(Role.accounts)
        .map((t) => t.name)
        .sort(),
    ).toEqual(['class_strength', 'collections', 'fee_outstanding']);
    expect(toolsFor(Role.parent)).toEqual(PARENT_TOOLS);
    expect(toolsFor(Role.teacher)).toEqual([]);
    expect(toolsFor(Role.admin)).toHaveLength(STAFF_TOOLS.length);
  });
});
