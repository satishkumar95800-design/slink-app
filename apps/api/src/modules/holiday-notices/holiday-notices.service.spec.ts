/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { Prisma } from '@prisma/client';
import { HolidayNoticesService } from './holiday-notices.service';

const tenant = { id: 't1', timezone: 'Asia/Kolkata', defaultLanguage: 'en' };
// 20/10/2026 07:30 IST = 02:00 UTC.
const MORNING = new Date('2026-10-20T02:00:00Z');

function setup() {
  const prisma: any = {
    schoolHoliday: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { date: new Date('2026-10-20T00:00:00Z'), name: 'Dussehra' },
        ]),
    },
    holidayNotice: {
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', preferredLanguage: null },
        { id: 'p2', preferredLanguage: 'kn' },
      ]),
    },
  };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    notifications,
    service: new HolidayNoticesService(prisma, notifications as any),
  };
}

describe('HolidayNoticesService', () => {
  it('tells every parent once, in their language, on the holiday morning', async () => {
    const { service, notifications, prisma } = setup();
    expect(await service.notifyTenant(tenant, MORNING)).toBe(2);
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'p1',
        title: 'School holiday today',
        body: 'School is closed today (20/10/2026) for Dussehra.',
        data: { type: 'holiday', from: '2026-10-20', to: '2026-10-20' },
      }),
    );
    expect(notifications.send.mock.calls[1][0].title).toBe('ಇಂದು ಶಾಲೆಗೆ ರಜೆ');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't1',
          linkedStudents: { some: {} },
        }),
      }),
    );
    expect(prisma.holidayNotice.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { sentCount: 2 } }),
    );
  });

  it('does not send twice for the same holiday', async () => {
    const { service, notifications, prisma } = setup();
    prisma.holidayNotice.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5',
      }),
    );
    expect(await service.notifyTenant(tenant, MORNING)).toBe(0);
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('waits until 07:00 and stops at 11:00 school time', async () => {
    const { service, notifications } = setup();
    expect(
      await service.notifyTenant(tenant, new Date('2026-10-20T01:00:00Z')),
    ).toBe(0); // 06:30
    expect(
      await service.notifyTenant(tenant, new Date('2026-10-20T05:45:00Z')),
    ).toBe(0); // 11:15
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('stays quiet on a school day', async () => {
    const { service, notifications } = setup();
    expect(
      await service.notifyTenant(tenant, new Date('2026-10-19T02:00:00Z')),
    ).toBe(0);
    expect(notifications.send).not.toHaveBeenCalled();
  });
});
