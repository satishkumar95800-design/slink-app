import { Prisma } from '@prisma/client';
import { ClassRemindersService } from './class-reminders.service';

// Thu 08 Oct 2026, 08:55 IST.
const NOW = new Date('2026-10-08T03:25:00.000Z');

function slot(
  id: string,
  periodNumber: number,
  minutesBefore?: number | null,
  classId = 'c1',
) {
  return {
    id,
    periodNumber,
    class: { id: classId, name: 'Class 8', section: 'A' },
    subject: { name: 'Science' },
    teacher: {
      fcmTokens: ['token-1'],
      preferredLanguage: null,
      classReminderSetting:
        minutesBefore === undefined ? null : { minutesBefore },
    },
  };
}

describe('ClassRemindersService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let fcm: { sendMulticast: jest.Mock };
  let service: ClassRemindersService;
  const sentCalls = () =>
    fcm.sendMulticast.mock.calls as [string[], string, string][];

  beforeEach(() => {
    prisma = {
      tenant: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'tenant-a', timezone: 'Asia/Kolkata', defaultLanguage: 'en' },
          ]),
      },
      periodTiming: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { periodNumber: 1, startTime: '09:00', endTime: '09:45' },
          ]),
      },
      classPeriodTiming: { findMany: jest.fn().mockResolvedValue([]) },
      schoolHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
      timetableSlot: { findMany: jest.fn().mockResolvedValue([]) },
      classReminderSent: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
      classReminderSetting: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    fcm = { sendMulticast: jest.fn().mockResolvedValue({}) };
    service = new ClassRemindersService(prisma as never, fcm as never);
  });

  it('reminds the teacher 5 minutes before by default', async () => {
    prisma.timetableSlot.findMany.mockResolvedValue([slot('s1', 1)]);

    await service.tick(NOW);

    expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          dayOfWeek: 4,
          periodNumber: { in: [1] },
        },
      }),
    );
    expect(fcm.sendMulticast).toHaveBeenCalledWith(
      ['token-1'],
      'Class in 5 minutes',
      'Science · Class 8 A · Period 1 at 09:00',
      { type: 'class_reminder' },
    );
  });

  it("waits for the teacher's own lead time, and skips switched-off reminders", async () => {
    prisma.timetableSlot.findMany.mockResolvedValue([
      slot('s1', 1, 2),
      slot('s2', 1, null, 'c2'),
    ]);
    await service.tick(NOW);
    expect(fcm.sendMulticast).not.toHaveBeenCalled();

    await service.tick(new Date('2026-10-08T03:28:00.000Z')); // 08:58
    expect(fcm.sendMulticast).toHaveBeenCalledTimes(1);
    expect(sentCalls()[0][1]).toBe('Class in 2 minutes');
  });

  it("uses a class's own bell schedule", async () => {
    prisma.periodTiming.findMany.mockResolvedValue([]);
    prisma.classPeriodTiming.findMany
      .mockResolvedValueOnce([{ periodNumber: 1 }])
      .mockResolvedValueOnce([
        {
          classId: 'c1',
          periodNumber: 1,
          startTime: '08:58',
          endTime: '09:40',
        },
      ]);
    prisma.timetableSlot.findMany.mockResolvedValue([slot('s1', 1)]);

    await service.tick(NOW);

    expect(sentCalls()[0][2]).toContain('at 08:58');
  });

  it('sends each reminder once', async () => {
    prisma.timetableSlot.findMany.mockResolvedValue([slot('s1', 1)]);
    prisma.classReminderSent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5',
      }),
    );
    await service.tick(NOW);
    expect(fcm.sendMulticast).not.toHaveBeenCalled();
  });

  it('stays quiet on holidays and when nothing starts soon', async () => {
    prisma.schoolHoliday.findUnique.mockResolvedValue({ id: 'h1' });
    await service.tick(NOW);
    expect(prisma.timetableSlot.findMany).not.toHaveBeenCalled();

    prisma.schoolHoliday.findUnique.mockResolvedValue(null);
    prisma.periodTiming.findMany.mockResolvedValue([]);
    await service.tick(NOW);
    expect(prisma.timetableSlot.findMany).not.toHaveBeenCalled();
  });

  it('defaults the setting to 5 minutes until the teacher changes it', async () => {
    prisma.classReminderSetting.findUnique.mockResolvedValue(null);
    expect(await service.getSetting('t1')).toEqual({ minutesBefore: 5 });
    prisma.classReminderSetting.findUnique.mockResolvedValue({
      minutesBefore: null,
    });
    expect(await service.getSetting('t1')).toEqual({ minutesBefore: null });
  });
});
