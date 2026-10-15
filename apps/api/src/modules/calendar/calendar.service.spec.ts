import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, SchoolEventType } from '@prisma/client';
import { CalendarService } from './calendar.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const ADMIN: ActiveUser = {
  id: 'admin-1',
  role: Role.admin,
  tenantId: 'tenant-a',
  name: 'Admin',
  isVerified: true,
};
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

function setup() {
  const prisma = {
    schoolEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const attendance = { listHolidays: jest.fn().mockResolvedValue([]) };
  const service = new CalendarService(prisma as never, attendance as never);
  return { prisma, attendance, service };
}

const eventRow = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  tenantId: 'tenant-a',
  type: SchoolEventType.EVENT,
  title: 'Sports day',
  description: null,
  startDate: day('2026-11-10'),
  endDate: null,
  startTime: null,
  endTime: null,
  venue: null,
  ...over,
});

describe('CalendarService', () => {
  describe('list', () => {
    it('merges holidays and events sorted by date and tags types', async () => {
      const { prisma, attendance, service } = setup();
      attendance.listHolidays.mockResolvedValue([
        { id: 'h1', date: '2026-11-12', name: 'Diwali' },
      ]);
      prisma.schoolEvent.findMany.mockResolvedValue([
        eventRow({
          id: 'e2',
          type: 'PTM',
          title: 'PTM',
          startDate: day('2026-11-15'),
        }),
        eventRow(),
      ]);
      const res = await service.list('tenant-a', '2026-11-01', '2026-11-30');
      expect(res.data.map((i) => [i.startDate, i.type])).toEqual([
        ['2026-11-10', 'EVENT'],
        ['2026-11-12', 'HOLIDAY'],
        ['2026-11-15', 'PTM'],
      ]);
      expect(attendance.listHolidays).toHaveBeenCalledWith(
        'tenant-a',
        '2026-11-01',
        '2026-11-30',
      );
      expect(res.data[0].endDate).toBe('2026-11-10');
    });

    it('scopes the event query to the tenant and overlapping range', async () => {
      const { prisma, service } = setup();
      await service.list('tenant-a', '2026-11-01', '2026-11-30');
      expect(prisma.schoolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            AND: expect.arrayContaining([
              { startDate: { lte: day('2026-11-30') } },
            ]) as unknown,
          }) as unknown,
        }),
      );
    });

    it('rejects reversed, invalid and oversized ranges', async () => {
      const { service } = setup();
      await expect(
        service.list('t', '2026-11-30', '2026-11-01'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.list('t', '2026-02-30', '2026-03-01'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.list('t', '2026-01-01', '2027-06-01'),
      ).rejects.toThrow(/366 days/);
    });
  });

  describe('createEvent', () => {
    const base = {
      type: SchoolEventType.PTM,
      title: '  Term 2 PTM ',
      startDate: '2026-11-20',
    };

    it('stores trimmed values, tenant from caller, and audits', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.create.mockResolvedValue(
        eventRow({
          type: 'PTM',
          title: 'Term 2 PTM',
          startDate: day('2026-11-20'),
        }),
      );
      const out = await service.createEvent(
        'tenant-a',
        { ...base, startTime: '10:00', endTime: '12:00', venue: ' Hall ' },
        ADMIN,
      );
      expect(prisma.schoolEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          title: 'Term 2 PTM',
          venue: 'Hall',
          endDate: null,
          createdBy: 'admin-1',
        }) as unknown,
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(out.type).toBe('PTM');
    });

    it('validates dates and times', async () => {
      const { prisma, service } = setup();
      await expect(
        service.createEvent('t', { ...base, endDate: '2026-11-19' }, ADMIN),
      ).rejects.toThrow(/End date/);
      await expect(
        service.createEvent('t', { ...base, endTime: '11:00' }, ADMIN),
      ).rejects.toThrow(/start time/);
      await expect(
        service.createEvent(
          't',
          { ...base, startTime: '12:00', endTime: '11:00' },
          ADMIN,
        ),
      ).rejects.toThrow(/after the start time/);
      await expect(
        service.createEvent('t', { ...base, startDate: '2026-02-30' }, ADMIN),
      ).rejects.toThrow(/valid calendar date/);
      expect(prisma.schoolEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    it('404s for another tenant event', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteEvent('tenant-b', 'e1', ADMIN),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.schoolEvent.findFirst).toHaveBeenCalledWith({
        where: { id: 'e1', tenantId: 'tenant-b' },
      });
      expect(prisma.schoolEvent.delete).not.toHaveBeenCalled();
    });

    it('deletes and audits', async () => {
      const { prisma, service } = setup();
      prisma.schoolEvent.findFirst.mockResolvedValue(eventRow());
      await service.deleteEvent('tenant-a', 'e1', ADMIN);
      expect(prisma.schoolEvent.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
