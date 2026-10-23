/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { SchoolBusService } from './school-bus.service';

const T = 'tenant-1';
const ACTOR = 'admin-1';

function makePrisma() {
  const prisma: any = {
    transportRoute: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transportStop: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    studentTransport: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    student: { count: jest.fn(), findMany: jest.fn() },
    studentParent: { findFirst: jest.fn() },
    pettyCashPayee: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

const route = { name: 'Route 1', stops: [] as { id?: string; name: string }[] };

describe('SchoolBusService', () => {
  let prisma: any;
  let service: SchoolBusService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SchoolBusService(prisma);
  });

  describe('parent view', () => {
    it("refuses a child that isn't the parent's", async () => {
      prisma.studentParent.findFirst.mockResolvedValue(null);
      await expect(
        service.child(T, 'parent-1', 'student-x'),
      ).rejects.toMatchObject({
        response: { code: 'STUDENT_NOT_FOUND' },
      });
      expect(prisma.studentParent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            studentId: 'student-x',
            parentId: 'parent-1',
            student: { tenantId: T },
          },
        }),
      );
    });

    it('says the child is not on a bus', async () => {
      prisma.studentParent.findFirst.mockResolvedValue({
        student: { id: 's1', name: 'Asha', transport: null },
      });
      expect(await service.child(T, 'parent-1', 's1')).toEqual({
        student: { id: 's1', name: 'Asha' },
        bus: null,
      });
    });

    it("shows the route, stop and driver's phone, hiding a deactivated attendant", async () => {
      prisma.studentParent.findFirst.mockResolvedValue({
        student: {
          id: 's1',
          name: 'Asha',
          transport: {
            stop: { name: 'MG Road', pickupTime: '07:40', dropTime: '15:50' },
            route: {
              name: 'Route 1',
              vehicleNumber: 'KA01AB1234',
              driver: {
                id: 'd1',
                name: 'Ramesh',
                phone: '+919800000001',
                isActive: true,
              },
              attendant: {
                id: 'a1',
                name: 'Lakshmi',
                phone: '+919800000002',
                isActive: false,
              },
            },
          },
        },
      });
      const res = await service.child(T, 'parent-1', 's1');
      expect(res.bus).toEqual({
        routeName: 'Route 1',
        vehicleNumber: 'KA01AB1234',
        stop: { name: 'MG Road', pickupTime: '07:40', dropTime: '15:50' },
        driver: { name: 'Ramesh', phone: '+919800000001' },
        attendant: null,
      });
    });
  });

  it('refuses a driver who is not active ground staff of the school', async () => {
    prisma.pettyCashPayee.count.mockResolvedValue(0);
    await expect(
      service.createRoute(T, ACTOR, { ...route, driverId: 'vendor-1' }),
    ).rejects.toMatchObject({ response: { code: 'DRIVER_INVALID' } });
    expect(prisma.transportRoute.create).not.toHaveBeenCalled();
  });

  it('creates a route with its stops in order and audits it', async () => {
    prisma.pettyCashPayee.count.mockResolvedValue(1);
    prisma.transportRoute.create.mockResolvedValue({ id: 'r1' });
    await service.createRoute(T, ACTOR, {
      name: 'Route 1',
      driverId: 'd1',
      stops: [{ name: 'Gate' }, { name: 'MG Road', pickupTime: '07:40' }],
    });
    expect(prisma.transportStop.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'Gate',
          sortOrder: 0,
          routeId: 'r1',
          tenantId: T,
        }),
        expect.objectContaining({
          name: 'MG Road',
          sortOrder: 1,
          pickupTime: '07:40',
        }),
      ],
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'transport.route_created',
        entityId: 'r1',
      }),
    });
  });

  it("won't remove a stop that still has students", async () => {
    prisma.transportRoute.findFirst.mockResolvedValue({
      id: 'r1',
      name: 'Route 1',
    });
    prisma.transportStop.findMany.mockResolvedValue([
      { id: 'stop-1', _count: { students: 3 } },
      { id: 'stop-2', _count: { students: 0 } },
    ]);
    await expect(
      service.updateRoute(T, ACTOR, 'r1', {
        ...route,
        stops: [{ id: 'stop-2', name: 'Gate' }],
      }),
    ).rejects.toMatchObject({ response: { code: 'STOP_HAS_STUDENTS' } });
    expect(prisma.transportStop.deleteMany).not.toHaveBeenCalled();
  });

  it("won't delete a route that still has students", async () => {
    prisma.transportRoute.findFirst.mockResolvedValue({
      id: 'r1',
      name: 'Route 1',
    });
    prisma.studentTransport.count.mockResolvedValue(12);
    await expect(service.deleteRoute(T, ACTOR, 'r1')).rejects.toMatchObject({
      response: { code: 'ROUTE_HAS_STUDENTS' },
    });
    expect(prisma.transportRoute.delete).not.toHaveBeenCalled();
  });

  describe('assigning students', () => {
    beforeEach(() => {
      prisma.transportRoute.findFirst.mockResolvedValue({
        id: 'r1',
        name: 'Route 1',
      });
    });

    it('refuses a stop from another route', async () => {
      prisma.transportStop.findFirst.mockResolvedValue(null);
      await expect(
        service.assign(T, ACTOR, {
          routeId: 'r1',
          stopId: 'other',
          studentIds: ['s1'],
        }),
      ).rejects.toMatchObject({ response: { code: 'STOP_NOT_FOUND' } });
    });

    it('refuses a student from another school', async () => {
      prisma.student.count.mockResolvedValue(1);
      await expect(
        service.assign(T, ACTOR, { routeId: 'r1', studentIds: ['s1', 's2'] }),
      ).rejects.toMatchObject({ response: { code: 'STUDENT_NOT_FOUND' } });
      expect(prisma.studentTransport.upsert).not.toHaveBeenCalled();
    });

    it('puts students on the route, moving them off any other', async () => {
      prisma.transportStop.findFirst.mockResolvedValue({ id: 'stop-1' });
      prisma.student.count.mockResolvedValue(2);
      const res = await service.assign(T, ACTOR, {
        routeId: 'r1',
        stopId: 'stop-1',
        studentIds: ['s1', 's2', 's1'],
      });
      expect(res).toEqual({ assigned: 2 });
      expect(prisma.studentTransport.upsert).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        create: {
          studentId: 's1',
          tenantId: T,
          routeId: 'r1',
          stopId: 'stop-1',
        },
        update: { routeId: 'r1', stopId: 'stop-1' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'transport.students_assigned',
        }),
      });
    });
  });

  describe('ground staff', () => {
    it('adds a driver with the phone stored without spaces, audit-logged', async () => {
      prisma.pettyCashPayee.create.mockResolvedValue({
        id: 'p1',
        name: 'Raju',
      });
      await service.addGroundStaff(T, ACTOR, {
        name: 'Raju',
        phone: '+91 98450 77788',
      });
      expect(prisma.pettyCashPayee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GROUND_STAFF',
          phone: '+919845077788',
        }),
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'transport.ground_staff_added',
          }),
        }),
      );
    });

    it('deactivating removes their driver login', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Raju',
        phone: '+919845077788',
        isActive: true,
        userId: 'u1',
      });
      await service.updateGroundStaff(T, ACTOR, 'p1', { isActive: false });
      expect(prisma.pettyCashPayee.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ isActive: false, userId: null }),
      });
      expect(prisma.user.deleteMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: T, role: 'driver' },
      });
    });

    it('a name change keeps the driver login', async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Raju',
        phone: '+919845077788',
        isActive: true,
        userId: 'u1',
      });
      await service.updateGroundStaff(T, ACTOR, 'p1', { name: 'Raju K' });
      expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    });

    it("refuses another school's record", async () => {
      prisma.pettyCashPayee.findFirst.mockResolvedValue(null);
      await expect(
        service.updateGroundStaff(T, ACTOR, 'p9', { name: 'X' }),
      ).rejects.toMatchObject({
        response: { code: 'DRIVER_NOT_FOUND' },
      });
      expect(prisma.pettyCashPayee.findFirst).toHaveBeenCalledWith({
        where: { id: 'p9', tenantId: T, type: 'GROUND_STAFF' },
      });
    });
  });
});
