import { Role } from '@prisma/client';
import { TeacherDashboardService } from './teacher-dashboard.service';

describe('TeacherDashboardService', () => {
  let prisma: Record<string, Record<string, jest.Mock>>;
  let broadcasts: { seenCounts: jest.Mock };
  let service: TeacherDashboardService;

  beforeEach(() => {
    prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }) },
      schoolHoliday: { findUnique: jest.fn().mockResolvedValue(null) },
      timetableSlot: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(8) },
      periodTiming: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn() },
      classTeacher: { count: jest.fn().mockResolvedValue(2) },
      teacherSubject: { findMany: jest.fn().mockResolvedValue([]) },
      report: { findMany: jest.fn().mockResolvedValue([]) },
      broadcast: { findMany: jest.fn().mockResolvedValue([]) },
    };
    broadcasts = { seenCounts: jest.fn().mockResolvedValue(new Map()) };
    service = new TeacherDashboardService(prisma as never, broadcasts as never);
  });

  afterEach(() => jest.useRealTimers());

  describe('getToday', () => {
    it("returns today's periods with times from the bell schedule, in the school timezone", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-08T05:15:00.000Z')); // Thu 10:45 IST
      prisma.timetableSlot.findMany.mockResolvedValue([
        { periodNumber: 3, class: { id: 'c1', name: 'Class 3', section: 'B' }, subject: { name: 'Maths' } },
        { periodNumber: 4, class: { id: 'c2', name: 'Class 5', section: 'A' }, subject: { name: 'Science' } },
      ]);
      prisma.periodTiming.findMany.mockResolvedValue([
        { periodNumber: 3, startTime: '10:30', endTime: '11:15' },
        { periodNumber: 4, startTime: '11:15', endTime: '12:00' },
      ]);

      const today = await service.getToday('tenant-a', 'teacher-1');

      expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a', teacherId: 'teacher-1', dayOfWeek: 4 } }),
      );
      expect(today).toMatchObject({ date: '2026-10-08', weekday: 4, nowTime: '10:45', offDay: false, timingsConfigured: true });
      expect(today.periods[0]).toMatchObject({ periodNumber: 3, startTime: '10:30', endTime: '11:15', subject: 'Maths' });
    });

    it('is an off day on Sundays and holidays', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-10-11T05:00:00.000Z')); // Sunday
      expect(await service.getToday('tenant-a', 'teacher-1')).toMatchObject({ offDay: true, periods: [] });

      jest.setSystemTime(new Date('2026-10-12T05:00:00.000Z')); // Monday, but a holiday
      prisma.schoolHoliday.findUnique.mockResolvedValue({ name: 'Dussehra' });
      expect(await service.getToday('tenant-a', 'teacher-1')).toMatchObject({ offDay: true, holiday: 'Dussehra' });
      expect(prisma.timetableSlot.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getWorkload', () => {
    it('counts each notice/homework once alongside reports, and unread = nobody opened it', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'teacher-1', name: 'Neha', role: Role.teacher }]);
      prisma.report.findMany.mockResolvedValue([{ _count: { readReceipts: 1 } }, { _count: { readReceipts: 0 } }]);
      prisma.broadcast.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]);
      broadcasts.seenCounts.mockResolvedValue(
        new Map([
          ['b1', { recipients: 35, seen: 28 }],
          ['b2', { recipients: 35, seen: 0 }],
        ]),
      );

      const [row] = await service.getWorkload('tenant-a');

      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-a', teacherId: 'teacher-1', type: { not: 'homework' } } }),
      );
      expect(row).toMatchObject({ reportsSent: 5, reportsUnread: 3 }); // 2 reports + 3 items; 1 unread report + b2 + b3
    });
  });
});
