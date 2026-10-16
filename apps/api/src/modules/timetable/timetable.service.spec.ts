import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TimetableService } from './timetable.service';

describe('TimetableService period timings', () => {
  const prisma = {
    periodTiming: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    classPeriodTiming: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    class: { count: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const service = new TimetableService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('replaces the whole schedule for the school', async () => {
    await service.replacePeriodTimings('tenant-a', [
      { periodNumber: 2, startTime: '09:45', endTime: '10:30' },
      { periodNumber: 1, startTime: '09:00', endTime: '09:45' },
    ]);
    expect(prisma.periodTiming.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
    });
    expect(prisma.periodTiming.createMany).toHaveBeenCalledWith({
      data: [
        {
          tenantId: 'tenant-a',
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:45',
        },
        {
          tenantId: 'tenant-a',
          periodNumber: 2,
          startTime: '09:45',
          endTime: '10:30',
        },
      ],
    });
  });

  it.each([
    [
      [{ periodNumber: 1, startTime: '10:00', endTime: '09:00' }],
      /end after it starts/,
    ],
    [
      [
        { periodNumber: 1, startTime: '09:00', endTime: '09:45' },
        { periodNumber: 1, startTime: '10:00', endTime: '10:45' },
      ],
      /listed twice/,
    ],
    [
      [
        { periodNumber: 1, startTime: '09:00', endTime: '10:00' },
        { periodNumber: 2, startTime: '09:30', endTime: '10:30' },
      ],
      /starts before/,
    ],
  ])('rejects invalid schedules %#', async (periods, message) => {
    await expect(
      service.replacePeriodTimings('tenant-a', periods),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.replacePeriodTimings('tenant-a', periods),
    ).rejects.toThrow(message);
    expect(prisma.periodTiming.deleteMany).not.toHaveBeenCalled();
  });

  describe('class schedules', () => {
    const periods = [{ periodNumber: 1, startTime: '08:30', endTime: '09:10' }];

    it('gives every chosen class the same schedule, replacing their old one', async () => {
      prisma.class.count.mockResolvedValue(2);
      await service.replaceClassPeriodTimings(
        'tenant-a',
        ['c1', 'c2', 'c1'],
        periods,
      );
      expect(prisma.classPeriodTiming.deleteMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-a', classId: { in: ['c1', 'c2'] } },
      });
      expect(prisma.classPeriodTiming.createMany).toHaveBeenCalledWith({
        data: [
          { tenantId: 'tenant-a', classId: 'c1', ...periods[0] },
          { tenantId: 'tenant-a', classId: 'c2', ...periods[0] },
        ],
      });
      expect(prisma.periodTiming.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a class from another school', async () => {
      prisma.class.count.mockResolvedValue(1);
      await expect(
        service.replaceClassPeriodTimings('tenant-a', ['c1', 'c9'], periods),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.classPeriodTiming.deleteMany).not.toHaveBeenCalled();
    });

    it('validates class schedules like the school one', async () => {
      prisma.class.count.mockResolvedValue(1);
      await expect(
        service.replaceClassPeriodTimings(
          'tenant-a',
          ['c1'],
          [{ periodNumber: 1, startTime: '10:00', endTime: '09:00' }],
        ),
      ).rejects.toThrow(/end after it starts/);
    });
  });
});

describe('TimetableService.findMine', () => {
  it("adds each period's bell times, preferring the class's own schedule", async () => {
    const slot = (id: string, classId: string, periodNumber: number) => ({
      id,
      classId,
      periodNumber,
      dayOfWeek: 1,
    });
    const prisma = {
      timetableSlot: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            slot('a', 'c1', 1),
            slot('b', 'c2', 1),
            slot('c', 'c1', 9),
          ]),
      },
      periodTiming: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { periodNumber: 1, startTime: '09:00', endTime: '09:45' },
          ]),
      },
      classPeriodTiming: {
        findMany: jest.fn().mockResolvedValue([
          {
            classId: 'c2',
            periodNumber: 1,
            startTime: '08:30',
            endTime: '09:10',
          },
        ]),
      },
    };
    const rows = await new TimetableService(prisma as never).findMine(
      't',
      'teacher',
    );
    expect(rows.map((r) => [r.id, r.startTime, r.endTime])).toEqual([
      ['a', '09:00', '09:45'],
      ['b', '08:30', '09:10'],
      ['c', null, null],
    ]);
  });
});
