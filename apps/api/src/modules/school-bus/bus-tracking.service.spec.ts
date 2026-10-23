/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { BusTripDirection, Role } from '@prisma/client';
import { BusTrackingService, tripState } from './bus-tracking.service';

const T = 'tenant-1';
const DRIVER = 'driver-user-1';

function makePrisma() {
  const prisma: any = {
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ features: { busTracking: true } }),
    },
    pettyCashPayee: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn(), create: jest.fn(), deleteMany: jest.fn() },
    transportRoute: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    transportStop: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    busTrip: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    studentParent: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  return prisma;
}

const at = (iso: string) => new Date(iso);

describe('tripState', () => {
  const now = at('2026-10-23T08:00:00Z');
  it('is live with a fresh position, stale after 5 minutes, over after 30', () => {
    const t = { startedAt: at('2026-10-23T07:30:00Z'), endedAt: null };
    expect(
      tripState({ ...t, positionAt: at('2026-10-23T07:58:00Z') }, now),
    ).toBe('live');
    expect(
      tripState({ ...t, positionAt: at('2026-10-23T07:50:00Z') }, now),
    ).toBe('stale');
    expect(
      tripState({ ...t, positionAt: at('2026-10-23T07:20:00Z') }, now),
    ).toBe('over');
  });
  it('is over when ended or older than 4 hours', () => {
    expect(
      tripState(
        {
          startedAt: at('2026-10-23T07:00:00Z'),
          endedAt: now,
          positionAt: now,
        },
        now,
      ),
    ).toBe('over');
    expect(
      tripState(
        {
          startedAt: at('2026-10-23T03:30:00Z'),
          endedAt: null,
          positionAt: now,
        },
        now,
      ),
    ).toBe('over');
  });
});

describe('BusTrackingService', () => {
  let prisma: any;
  let service: BusTrackingService;
  let notifications: { send: jest.Mock };

  beforeEach(() => {
    prisma = makePrisma();
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new BusTrackingService(prisma, notifications as never);
  });

  it('answers FEATURE_DISABLED without the busTracking flag', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      features: { transport: true },
    });
    await expect(service.driverHome(T, DRIVER)).rejects.toMatchObject({
      response: { code: 'FEATURE_DISABLED' },
    });
  });

  describe('driver app access', () => {
    const payee = {
      id: 'p1',
      name: 'Raju',
      phone: '+919800000001',
      userId: null,
    };

    it('makes a driver login from the ground staff phone, audit-logged', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue(payee);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u-new' });
      await service.grantAccess(T, 'admin-1', 'p1');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.driver,
            phone: payee.phone,
          }),
        }),
      );
      expect(prisma.pettyCashPayee.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { userId: 'u-new' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'transport.driver_access_granted',
          }),
        }),
      );
    });

    it('refuses a phone that belongs to a parent or staff login', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue(payee);
      prisma.user.findFirst.mockResolvedValue({
        id: 'u2',
        role: Role.parent,
        driverOf: null,
      });
      await expect(
        service.grantAccess(T, 'admin-1', 'p1'),
      ).rejects.toMatchObject({
        response: { code: 'PHONE_IN_USE' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('stores the phone without spaces, as the app signs in with it', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue({
        ...payee,
        phone: '+91 98450 77788',
      });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'u-new' });
      await service.grantAccess(T, 'admin-1', 'p1');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: '+919845077788' }),
        }),
      );
    });

    it('needs a phone with country code', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue({
        ...payee,
        phone: '98000 00001',
      });
      await expect(
        service.grantAccess(T, 'admin-1', 'p1'),
      ).rejects.toMatchObject({
        response: { code: 'DRIVER_PHONE_MISSING' },
      });
    });

    it('removing access deletes only the driver login', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Raju',
        userId: 'u1',
      });
      await service.revokeAccess(T, 'admin-1', 'p1');
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: T, role: Role.driver },
      });
    });
  });

  describe('trips', () => {
    it("can't start a trip on a route that isn't the driver's", async () => {
      prisma.transportRoute.findMany.mockResolvedValue([]);
      await expect(
        service.startTrip(T, DRIVER, {
          routeId: 'r-other',
          direction: 'pickup',
        }),
      ).rejects.toMatchObject({ response: { code: 'ROUTE_NOT_FOUND' } });
      expect(prisma.transportRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: T, driver: { userId: DRIVER, isActive: true } },
        }),
      );
    });

    it("refuses while another driver's trip is running on the route", async () => {
      prisma.transportRoute.findMany.mockResolvedValue([
        { id: 'r1', stops: [], _count: { students: 3 } },
      ]);
      prisma.busTrip.findMany.mockResolvedValue([
        {
          id: 't0',
          driverUserId: 'someone-else',
          startedAt: new Date(),
          endedAt: null,
          positionAt: new Date(),
        },
      ]);
      await expect(
        service.startTrip(T, DRIVER, { routeId: 'r1', direction: 'pickup' }),
      ).rejects.toMatchObject({ response: { code: 'TRIP_IN_PROGRESS' } });
    });

    it("closes the driver's own earlier trip and starts a new one", async () => {
      prisma.transportRoute.findMany.mockResolvedValue([
        { id: 'r1', stops: [], _count: { students: 3 } },
      ]);
      prisma.busTrip.findMany.mockResolvedValue([
        {
          id: 't0',
          driverUserId: DRIVER,
          startedAt: new Date(),
          endedAt: null,
          positionAt: null,
        },
      ]);
      prisma.busTrip.create.mockResolvedValue({
        id: 't1',
        routeId: 'r1',
        direction: 'pickup',
        startedAt: new Date(),
        endedAt: null,
        lat: null,
        lng: null,
        speed: null,
        heading: null,
        positionAt: null,
      });
      const trip = await service.startTrip(T, DRIVER, {
        routeId: 'r1',
        direction: 'pickup',
      });
      expect(prisma.busTrip.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['t0'] } } }),
      );
      expect(trip).toMatchObject({ id: 't1', state: 'live', position: null });
    });

    it('drops a position older than the stored one', async () => {
      prisma.busTrip.findFirst.mockResolvedValue({
        id: 't1',
        startedAt: new Date(Date.now() - 60_000),
        endedAt: null,
        positionAt: new Date(),
        passedStopIds: [],
        alertedStopIds: [],
      });
      const r = await service.position(T, DRIVER, 't1', {
        lat: 12.9,
        lng: 77.6,
        at: new Date(Date.now() - 30_000).toISOString(),
      });
      expect(r).toEqual({ accepted: false, reachedStopIds: [] });
      expect(prisma.busTrip.update).not.toHaveBeenCalled();
    });

    it("only the trip's driver can send its position", async () => {
      prisma.busTrip.findFirst.mockResolvedValue(null);
      await expect(
        service.position(T, 'other-driver', 't1', { lat: 1, lng: 1 }),
      ).rejects.toMatchObject({
        response: { code: 'TRIP_NOT_RUNNING' },
      });
      expect(prisma.busTrip.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ driverUserId: 'other-driver' }),
        }),
      );
    });
  });

  describe('stops reached, arrival push and stop locations', () => {
    // Two stops 1.1 km apart on the pickup run.
    const STOPS = [
      {
        id: 's-a',
        name: 'Temple',
        sortOrder: 0,
        lat: 12.9,
        lng: 77.6,
        pickupTime: null,
        dropTime: null,
      },
      {
        id: 's-b',
        name: 'Park',
        sortOrder: 1,
        lat: 12.91,
        lng: 77.6,
        pickupTime: null,
        dropTime: null,
      },
    ];
    const openTrip = (extra: object = {}) => ({
      id: 't1',
      routeId: 'r1',
      direction: 'pickup',
      startedAt: new Date(Date.now() - 60_000),
      endedAt: null,
      lat: null,
      lng: null,
      accuracy: null,
      positionAt: null,
      passedStopIds: [],
      alertedStopIds: [],
      ...extra,
    });
    const flush = () => new Promise((r) => setImmediate(r));
    const parentsAt = {
      name: 'Route 1',
      tenant: { defaultLanguage: 'en' },
      stops: [
        {
          id: 's-b',
          name: 'Park',
          students: [
            {
              studentId: 'kid-1',
              student: {
                parents: [
                  { parent: { id: 'mum', preferredLanguage: 'kn' } },
                  { parent: { id: 'dad', preferredLanguage: null } },
                ],
              },
            },
          ],
        },
      ],
    };

    it('marks a stop reached and sends one chime push per parent within 5 minutes', async () => {
      prisma.busTrip.findFirst.mockResolvedValue(openTrip());
      prisma.transportStop.findMany.mockResolvedValue(STOPS);
      prisma.transportRoute.findFirst.mockResolvedValue(parentsAt);
      const r = await service.position(T, DRIVER, 't1', {
        lat: 12.9,
        lng: 77.6,
      });
      expect(r).toEqual({ accepted: true, reachedStopIds: ['s-a'] });
      expect(prisma.busTrip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passedStopIds: ['s-a'],
            alertedStopIds: ['s-b'],
          }),
        }),
      );
      await flush();
      expect(notifications.send).toHaveBeenCalledTimes(2);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'mum',
          sound: 'bus_arrival',
          title: expect.stringContaining('ನಿಮಿಷ'),
          data: { type: 'bus_arriving', studentId: 'kid-1', tripId: 't1' },
        }),
      );
    });

    it('does not push a stop twice', async () => {
      prisma.busTrip.findFirst.mockResolvedValue(
        openTrip({ passedStopIds: ['s-a'], alertedStopIds: ['s-b'] }),
      );
      prisma.transportStop.findMany.mockResolvedValue(STOPS);
      await service.position(T, DRIVER, 't1', { lat: 12.905, lng: 77.6 });
      await flush();
      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('ignores a rough fix for stops reached', async () => {
      prisma.busTrip.findFirst.mockResolvedValue(openTrip());
      const r = await service.position(T, DRIVER, 't1', {
        lat: 12.9,
        lng: 77.6,
        accuracy: 900,
      });
      expect(r.reachedStopIds).toEqual([]);
      expect(prisma.transportStop.findMany).not.toHaveBeenCalled();
    });

    it('tells every parent on the route once when the trip starts', async () => {
      prisma.transportRoute.findFirst.mockResolvedValue({
        name: 'Route 1',
        tenant: { defaultLanguage: 'hi' },
        students: [
          {
            studentId: 'k1',
            student: {
              parents: [{ parent: { id: 'p1', preferredLanguage: null } }],
            },
          },
          {
            studentId: 'k2',
            student: {
              parents: [{ parent: { id: 'p1', preferredLanguage: null } }],
            },
          },
          {
            studentId: 'k3',
            student: {
              parents: [{ parent: { id: 'p2', preferredLanguage: 'en' } }],
            },
          },
        ],
      });
      const sent = await service.notifyStarted(
        T,
        'r1',
        't1',
        BusTripDirection.drop,
      );
      expect(sent).toBe(2);
      expect(notifications.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'p1',
          title: 'स्कूल बस स्कूल से निकल गई है',
          data: { type: 'bus_started', studentId: 'k1', tripId: 't1' },
        }),
      );
      expect(notifications.send.mock.calls[0][0].sound).toBeUndefined();
    });

    it("saves a stop's location from the trip's latest fix, audit-logged", async () => {
      prisma.busTrip.findFirst.mockResolvedValue(
        openTrip({
          lat: 12.95,
          lng: 77.61,
          accuracy: 10,
          positionAt: new Date(),
        }),
      );
      prisma.transportStop.findFirst.mockResolvedValue({
        id: 's-b',
        name: 'Park',
        lat: null,
        lng: null,
      });
      prisma.transportStop.findMany.mockResolvedValue(STOPS);
      const r = await service.stopHere(T, DRIVER, 't1', 's-b');
      expect(prisma.transportStop.update).toHaveBeenCalledWith({
        where: { id: 's-b' },
        data: { lat: 12.95, lng: 77.61 },
      });
      expect(r.reachedStopIds).toEqual(['s-a', 's-b']);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'transport.stop_located' }),
        }),
      );
    });

    it('needs a recent fix to save a stop', async () => {
      prisma.busTrip.findFirst.mockResolvedValue(
        openTrip({
          lat: 12.95,
          lng: 77.61,
          positionAt: new Date(Date.now() - 10 * 60_000),
        }),
      );
      prisma.transportStop.findFirst.mockResolvedValue({
        id: 's-b',
        name: 'Park',
        lat: null,
        lng: null,
      });
      await expect(
        service.stopHere(T, DRIVER, 't1', 's-b'),
      ).rejects.toMatchObject({
        response: { code: 'NO_GPS_FIX' },
      });
    });

    it('refuses a stop on another route', async () => {
      prisma.busTrip.findFirst.mockResolvedValue(
        openTrip({ positionAt: new Date() }),
      );
      prisma.transportStop.findFirst.mockResolvedValue(null);
      await expect(
        service.stopHere(T, DRIVER, 't1', 's-x'),
      ).rejects.toMatchObject({
        response: { code: 'STOP_NOT_FOUND' },
      });
      expect(prisma.transportStop.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-x', routeId: 'r1', tenantId: T },
        }),
      );
    });

    it("gives the parent the minutes to their child's stop", async () => {
      prisma.studentParent.findFirst.mockResolvedValue({
        student: {
          transport: {
            stop: {
              id: 's-b',
              name: 'Park',
              pickupTime: '07:40',
              dropTime: null,
            },
            route: {
              name: 'R1',
              vehicleNumber: null,
              driver: null,
              stops: STOPS,
              trips: [
                {
                  id: 't1',
                  routeId: 'r1',
                  direction: 'pickup',
                  startedAt: new Date(),
                  endedAt: null,
                  lat: 12.9,
                  lng: 77.6,
                  speed: 5,
                  heading: 0,
                  positionAt: new Date(),
                  passedStopIds: ['s-a'],
                },
              ],
            },
          },
        },
      });
      const r = await service.childLive(T, 'parent-1', 's1');
      // 1.11 km x 1.35 at 18 km/h = 5 minutes.
      expect(r.trip?.eta).toEqual({ minutes: 5, reached: false });
      expect(r.bus?.stop).toEqual({
        name: 'Park',
        pickupTime: '07:40',
        dropTime: null,
      });
    });
  });

  describe('parent view', () => {
    it("refuses a child that isn't the parent's", async () => {
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(
        service.childLive(T, 'parent-1', 's1'),
      ).rejects.toMatchObject({
        response: { code: 'STUDENT_NOT_FOUND' },
      });
      expect(prisma.studentParent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 's1',
            parentId: 'parent-1',
            student: { tenantId: T },
          },
        }),
      );
    });

    it('shows no trip when the last one was abandoned', async () => {
      const old = new Date(Date.now() - 60 * 60_000);
      prisma.studentParent.findFirst.mockResolvedValue({
        student: {
          transport: {
            stop: {
              id: 'g',
              name: 'Gate',
              pickupTime: '07:40',
              dropTime: null,
            },
            route: {
              stops: [],
              name: 'R1',
              vehicleNumber: 'KA01',
              driver: { name: 'Raju', phone: '+91', isActive: true },
              trips: [
                {
                  id: 't',
                  routeId: 'r',
                  direction: 'pickup',
                  startedAt: old,
                  endedAt: null,
                  lat: 1,
                  lng: 1,
                  speed: 0,
                  heading: 0,
                  positionAt: old,
                },
              ],
            },
          },
        },
      });
      const r = await service.childLive(T, 'parent-1', 's1');
      expect(r.trip).toBeNull();
      expect(r.bus?.routeName).toBe('R1');
    });
  });
});
