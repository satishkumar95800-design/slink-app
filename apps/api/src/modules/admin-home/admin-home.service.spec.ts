/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { urgentItems } from './admin-home.rules';
import { AdminHomeService } from './admin-home.service';

const T = 'tenant-1';

function setup(features: Record<string, boolean>) {
  const prisma: any = {
    tenant: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ timezone: 'Asia/Kolkata', features }),
    },
    receipt: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
    },
    paymentClaim: { count: jest.fn().mockResolvedValue(2) },
    leaveRequest: { count: jest.fn().mockResolvedValue(1) },
    pettyCashEntry: { count: jest.fn().mockResolvedValue(0) },
    admissionEnquiry: {
      count: jest.fn().mockResolvedValue(3),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { childName: 'Aarav', parentName: 'Ritu', phone: '98' },
        ]),
    },
    insightAlert: {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ severity: 'critical', _count: { _all: 1 } }]),
    },
    libraryLoan: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(14) },
    employee: {
      findMany: jest.fn().mockResolvedValue([
        { name: 'Anita', attendance: [{ status: 'PRESENT' }] },
        { name: 'Bharath', attendance: [{ status: 'ON_LEAVE' }] },
        { name: 'Chitra', attendance: [{ status: 'ABSENT' }] },
        { name: 'Divya', attendance: [] },
      ]),
    },
    schoolEvent: {
      findMany: jest.fn().mockResolvedValue([
        {
          title: 'PTM',
          type: 'PTM',
          startDate: new Date('2026-10-30T00:00:00Z'),
          endDate: null,
          startTime: '10:00',
        },
      ]),
    },
    schoolHoliday: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { name: 'Deepavali', date: new Date('2026-10-28T00:00:00Z') },
        ]),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([
        {
          time: '09:00',
          kind: 'interview',
          name: 'Ravi',
          withWhom: 'Principal',
          status: 'scheduled',
        },
        {
          time: '23:59',
          kind: 'parent_meeting',
          name: 'Mrs Rao',
          withWhom: null,
          status: 'scheduled',
        },
      ]),
      count: jest.fn().mockResolvedValue(4),
    },
  };
  const attendance: any = {
    getSchoolSummary: jest.fn().mockResolvedValue({
      holiday: null,
      totalStudents: 300,
      present: 250,
      absent: 10,
      late: 0,
      leave: 0,
      notMarked: [{ name: 'Class 3', section: 'A' }],
    }),
  };
  const buses: any = { live: jest.fn().mockResolvedValue([]) };
  return { prisma, service: new AdminHomeService(prisma, attendance, buses) };
}

beforeAll(() =>
  jest
    .useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    .setSystemTime(new Date('2026-10-24T06:30:00Z')),
);
afterAll(() => jest.useRealTimers());

describe('urgentItems', () => {
  const base = {
    now: '09:30',
    holiday: false,
    criticalAlerts: 0,
    busesNoSignal: 0,
    classesNotMarked: 4,
    staffNotMarked: 2,
    paymentClaims: 0,
    leaveRequests: null,
    pettyCash: null,
    followUpsOverdue: null,
    appointmentsWaiting: null,
  };

  it('counts unmarked attendance only after 10:00 and never on a holiday', () => {
    expect(urgentItems(base)).toEqual([]);
    expect(urgentItems({ ...base, now: '10:05' })).toEqual([
      { kind: 'classes_not_marked', count: 4 },
      { kind: 'staff_not_marked', count: 2 },
    ]);
    expect(urgentItems({ ...base, now: '11:00', holiday: true })).toEqual([]);
  });

  it('puts critical alerts first and leaves out empty items', () => {
    const items = urgentItems({
      ...base,
      criticalAlerts: 1,
      paymentClaims: 3,
      leaveRequests: 0,
    });
    expect(items.map((i) => i.kind)).toEqual([
      'critical_alerts',
      'payment_claims',
    ]);
  });
});

describe('AdminHomeService', () => {
  it('shows teachers present, upcoming events, the front desk and what needs attention', async () => {
    const { service } = setup({
      hrms: true,
      calendar: true,
      admissions: true,
      aiInsights: true,
    });
    const h = await service.home(T);
    expect(h.teachers).toEqual({
      total: 4,
      tracked: true,
      present: 1,
      halfDay: 0,
      absent: 1,
      onLeave: 1,
      notMarked: 1,
      away: [
        { name: 'Bharath', status: 'ON_LEAVE' },
        { name: 'Chitra', status: 'ABSENT' },
      ],
    });
    expect(h.events.map((e) => [e.kind, e.title, e.date])).toEqual([
      ['holiday', 'Deepavali', '2026-10-28'],
      ['ptm', 'PTM', '2026-10-30'],
    ]);
    expect(h.appointments).toMatchObject({ laterThisWeek: 4, waiting: 1 });
    expect(h.appointments?.tours).toHaveLength(1);
    // 12:00 in India: attendance is overdue.
    expect(h.urgent.map((i) => i.kind)).toEqual([
      'critical_alerts',
      'classes_not_marked',
      'staff_not_marked',
      'appointments_waiting',
      'payment_claims',
      'leave_requests',
      'follow_ups_overdue',
    ]);
  });

  it('without HR and the front desk: the teacher count only, no desk', async () => {
    const { service } = setup({});
    const h = await service.home(T);
    expect(h.teachers).toEqual({ total: 14, tracked: false });
    expect(h.appointments).toBeNull();
    expect(h.events.map((e) => e.kind)).toEqual(['holiday']);
  });
});
