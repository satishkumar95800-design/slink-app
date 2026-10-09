import { BadRequestException } from '@nestjs/common';
import { TimetableService } from './timetable.service';

describe('TimetableService period timings', () => {
  const prisma = {
    periodTiming: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
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
});
