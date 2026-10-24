/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { AppointmentKind } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

const T = 'tenant-1';
const row = {
  id: 'ap1',
  tenantId: T,
  kind: 'interview',
  name: 'Ravi Kumar',
  phone: '9876543210',
  withWhom: 'Principal',
  date: new Date('2026-10-24T00:00:00Z'),
  time: '11:30',
  note: null,
  status: 'scheduled',
};

function setup() {
  const prisma: any = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([row]),
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({ ...row, status: 'arrived' }),
    },
    auditLog: { create: jest.fn() },
  };
  prisma.$transaction = jest.fn((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  return { prisma, service: new AppointmentsService(prisma) };
}

describe('AppointmentsService', () => {
  beforeAll(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T05:00:00Z')),
  );
  afterAll(() => jest.useRealTimers());

  it('lists the coming week by day and time', async () => {
    const { service, prisma } = setup();
    expect(await service.list(T, {})).toEqual([
      expect.objectContaining({ date: '2026-10-24', time: '11:30' }),
    ]);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: T,
        date: {
          gte: new Date('2026-10-24T00:00:00Z'),
          lte: new Date('2026-10-30T00:00:00Z'),
        },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
  });

  it('books an appointment, audit-logged', async () => {
    const { service, prisma } = setup();
    await service.create(T, 'desk-1', {
      kind: AppointmentKind.interview,
      name: 'Ravi Kumar',
      date: '2026-10-25',
      time: '11:30',
    });
    expect(prisma.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: T,
        date: new Date('2026-10-25T00:00:00Z'),
        createdBy: 'desk-1',
        phone: null,
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'reception.appointment_booked',
        }),
      }),
    );
  });

  it("marks arrival only on this school's appointment", async () => {
    const { service, prisma } = setup();
    expect(
      await service.update(T, 'desk-1', 'ap1', { status: 'arrived' }),
    ).toMatchObject({ status: 'arrived' });
    prisma.appointment.findFirst.mockResolvedValue(null);
    await expect(
      service.update(T, 'desk-1', 'other', { status: 'arrived' }),
    ).rejects.toMatchObject({
      response: { code: 'APPOINTMENT_NOT_FOUND' },
    });
  });
});
