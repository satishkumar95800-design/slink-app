/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- jest Prisma mocks */
import { Prisma, Role } from '@prisma/client';
import { ReceptionService } from './reception.service';

const T = 'tenant-1';
const RECEPTIONIST = {
  id: 'r1',
  role: Role.receptionist,
  tenantId: T,
  name: 'Desk',
} as any;
const ADMIN = { id: 'a1', role: Role.admin, tenantId: T, name: 'Admin' } as any;
const D = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

function makePrisma() {
  const prisma: any = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    },
    admissionEnquiry: {
      findFirst: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn(),
    },
    admissionFollowUp: {
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    admissionDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    admissionPayment: {
      aggregate: jest.fn().mockResolvedValue({ _max: { receiptNo: 41 } }),
      create: jest
        .fn()
        .mockImplementation(({ data }) => ({ id: 'p1', ...data })),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    admissionActivity: { create: jest.fn() },
    callLog: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { create: jest.fn() },
    $executeRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return prisma;
}

describe('ReceptionService', () => {
  let prisma: any;
  let service: ReceptionService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ReceptionService(prisma);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-23T06:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  describe('follow-ups', () => {
    it('adds one, moves the enquiry next date to the earliest open one, and logs it', async () => {
      prisma.admissionFollowUp.findFirst.mockResolvedValue({
        dueOn: D('2026-10-25'),
      });
      await service.addFollowUp(T, RECEPTIONIST, 'e1', {
        dueOn: '2026-10-25',
        kind: 'call',
      });
      expect(prisma.admissionEnquiry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { nextFollowUpOn: D('2026-10-25') },
      });
      expect(prisma.admissionActivity.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'reception.follow_up_added',
          }),
        }),
      );
    });

    it('refuses a date in the past', async () => {
      await expect(
        service.addFollowUp(T, RECEPTIONIST, 'e1', {
          dueOn: '2026-10-22',
          kind: 'call',
        }),
      ).rejects.toMatchObject({ response: { code: 'DATE_IN_PAST' } });
    });

    it('ticking the last open one clears the next date', async () => {
      prisma.admissionFollowUp.findFirst
        .mockResolvedValueOnce({
          id: 'f1',
          enquiryId: 'e1',
          kind: 'call',
          doneAt: null,
        })
        .mockResolvedValueOnce(null);
      await service.setFollowUpDone(
        T,
        RECEPTIONIST,
        'f1',
        true,
        'Coming Saturday',
      );
      expect(prisma.admissionFollowUp.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: expect.objectContaining({
          doneBy: 'r1',
          outcome: 'Coming Saturday',
        }),
      });
      expect(prisma.admissionEnquiry.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { nextFollowUpOn: null },
      });
    });
  });

  describe('desk payments', () => {
    it('numbers receipts on from the last one, under a per-school lock', async () => {
      prisma.admissionPayment.findFirst.mockResolvedValue({
        id: 'p1',
        receiptNo: 42,
        purpose: 'registration_fee',
        amount: new Prisma.Decimal('500'),
        mode: 'cash',
        reference: null,
        receivedOn: D('2026-10-23'),
        receivedBy: 'r1',
        voidedAt: null,
        voidedBy: null,
        voidReason: null,
        createdAt: new Date(),
        enquiry: {},
        tenant: { name: 'S', branding: {} },
      });
      const r = await service.addPayment(T, RECEPTIONIST, 'e1', {
        purpose: 'registration_fee',
        amount: '500',
        mode: 'cash',
      });
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.admissionPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ receiptNo: 42, amount: '500.00' }),
        }),
      );
      expect(r.receiptNo).toBe(42);
    });

    it('refuses a future date and a zero amount', async () => {
      await expect(
        service.addPayment(T, RECEPTIONIST, 'e1', {
          purpose: 'other',
          amount: '100',
          mode: 'upi',
          receivedOn: '2026-10-24',
        }),
      ).rejects.toMatchObject({ response: { code: 'DATE_IN_FUTURE' } });
      await expect(
        service.addPayment(T, RECEPTIONIST, 'e1', {
          purpose: 'other',
          amount: '0',
          mode: 'upi',
        }),
      ).rejects.toMatchObject({ response: { code: 'AMOUNT_INVALID' } });
    });

    it('the receptionist cannot void a receipt; admin can, with a reason', async () => {
      await expect(
        service.voidPayment(T, RECEPTIONIST, 'p1', 'typo'),
      ).rejects.toMatchObject({
        response: { code: 'VOID_NOT_ALLOWED' },
      });
      prisma.admissionPayment.findFirst
        .mockResolvedValueOnce({
          id: 'p1',
          enquiryId: 'e1',
          receiptNo: 7,
          voidedAt: null,
        })
        .mockResolvedValueOnce({
          id: 'p1',
          receiptNo: 7,
          purpose: 'other',
          amount: new Prisma.Decimal('1'),
          mode: 'cash',
          reference: null,
          receivedOn: D('2026-10-23'),
          receivedBy: 'r1',
          voidedAt: new Date(),
          voidedBy: 'a1',
          voidReason: 'typo',
          createdAt: new Date(),
          enquiry: {},
          tenant: { name: 'S', branding: {} },
        });
      const r = await service.voidPayment(T, ADMIN, 'p1', 'typo');
      expect(prisma.admissionPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ voidedBy: 'a1', voidReason: 'typo' }),
        }),
      );
      expect(r.void).toMatchObject({ reason: 'typo' });
    });
  });

  it('refuses an unknown document', async () => {
    await expect(
      service.setDocument(T, RECEPTIONIST, 'e1', 'passport_of_pet', {
        received: true,
      }),
    ).rejects.toMatchObject({ response: { code: 'DOCUMENT_UNKNOWN' } });
  });

  it("refuses another school's enquiry", async () => {
    prisma.admissionEnquiry.findFirst.mockResolvedValue(null);
    await expect(service.enquiryDesk(T, 'e9')).rejects.toMatchObject({
      response: { code: 'ENQUIRY_NOT_FOUND' },
    });
    expect(prisma.admissionEnquiry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e9', tenantId: T } }),
    );
  });
});
