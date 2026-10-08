import { FeeStatus, PaymentClaimStatus, Prisma } from '@prisma/client';
import { FeeRemindersService } from './fee-reminders.service';

const NOW = new Date('2026-10-12T03:30:00.000Z'); // 09:00 IST on 12/10/2026
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

const fee = (id: string, dueDate: string, due = 6000, paid = 0) => ({
  id,
  amountDue: new Prisma.Decimal(due),
  amountPaid: new Prisma.Decimal(paid),
  dueDate: dbDate(dueDate),
  feeStructure: { name: 'Term 2' },
  student: { id: 's1', name: 'Avyaan Singha', parents: [{ parentId: 'parent-1' }] },
});

describe('FeeRemindersService', () => {
  let prisma: {
    tenant: { findMany: jest.Mock };
    studentFee: { findMany: jest.Mock };
    notification: { findFirst: jest.Mock };
  };
  let notifications: { send: jest.Mock };
  let service: FeeRemindersService;

  beforeEach(() => {
    prisma = {
      tenant: { findMany: jest.fn().mockResolvedValue([{ id: 'tenant-a', timezone: 'Asia/Kolkata' }]) },
      studentFee: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    notifications = { send: jest.fn().mockResolvedValue(undefined) };
    service = new FeeRemindersService(prisma as never, notifications as never);
  });

  it('looks for fees due today and in 3 days, skipping paid, waived and claimed fees', async () => {
    await service.sendDueReminders(NOW);

    expect(prisma.studentFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          status: { notIn: [FeeStatus.paid, FeeStatus.waived] },
          dueDate: { in: [dbDate('2026-10-12'), dbDate('2026-10-15')] },
          paymentClaims: { none: { status: PaymentClaimStatus.pending } },
        },
      }),
    );
  });

  it('sends "due in 3 days" and "due today" pushes with Indian formatting', async () => {
    prisma.studentFee.findMany.mockResolvedValue([fee('f-today', '2026-10-12', 6000, 1000), fee('f-soon', '2026-10-15')]);

    const { sent } = await service.sendDueReminders(NOW);

    expect(sent).toBe(2);
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'parent-1',
        title: 'Fee due today',
        body: '₹5,000 for Avyaan (Term 2) is due on 12/10/2026.',
        data: { type: 'fee_due', studentFeeId: 'f-today', studentId: 's1', reminderKey: 'fee_due:f-today:today:2026-10-12' },
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fee due in 3 days', body: '₹6,000 for Avyaan (Term 2) is due on 15/10/2026.' }),
    );
  });

  it('never sends the same reminder twice in a day', async () => {
    prisma.studentFee.findMany.mockResolvedValue([fee('f-today', '2026-10-12')]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'already-sent' });

    expect((await service.sendDueReminders(NOW)).sent).toBe(0);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a', userId: 'parent-1', data: { path: ['reminderKey'], equals: 'fee_due:f-today:today:2026-10-12' } },
      }),
    );
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('skips fees whose balance is already cleared', async () => {
    prisma.studentFee.findMany.mockResolvedValue([fee('f-today', '2026-10-12', 6000, 6000)]);
    expect((await service.sendDueReminders(NOW)).sent).toBe(0);
  });
});
