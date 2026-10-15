import { Role } from '@prisma/client';
import { CalendarController } from './calendar.controller';
import type { ActiveUser } from '../../common/types/active-user.type';

const ADMIN: ActiveUser = {
  id: 'a1',
  role: Role.admin,
  tenantId: 't1',
  name: 'Admin',
  isVerified: true,
};

function setup(features: unknown) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ features }) },
  };
  const service = {
    list: jest.fn().mockResolvedValue({ data: [] }),
    listEvents: jest.fn().mockResolvedValue([]),
    createEvent: jest.fn(),
    deleteEvent: jest.fn(),
  };
  return {
    service,
    controller: new CalendarController(prisma as never, service as never),
  };
}

describe('CalendarController feature flag', () => {
  it.each([{}, { calendar: false }, null])(
    'answers FEATURE_DISABLED on every endpoint when off (%j)',
    async (features) => {
      const { controller, service } = setup(features);
      const calls = [
        () => controller.list('t1', { from: '2026-10-01', to: '2026-10-31' }),
        () => controller.listEvents('t1', {}),
        () =>
          controller.createEvent('t1', ADMIN, {
            type: 'EVENT',
            title: 'x',
            startDate: '2026-10-10',
          }),
        () =>
          controller.deleteEvent(
            't1',
            ADMIN,
            '00000000-0000-4000-8000-000000000001',
          ),
      ];
      for (const call of calls)
        await expect(call()).rejects.toMatchObject({
          response: { code: 'FEATURE_DISABLED' },
        });
      expect(service.list).not.toHaveBeenCalled();
      expect(service.createEvent).not.toHaveBeenCalled();
      expect(service.deleteEvent).not.toHaveBeenCalled();
    },
  );

  it('serves the calendar when on', async () => {
    const { controller, service } = setup({ calendar: true });
    await controller.list('t1', { from: '2026-10-01', to: '2026-10-31' });
    expect(service.list).toHaveBeenCalledWith('t1', '2026-10-01', '2026-10-31');
  });
});
