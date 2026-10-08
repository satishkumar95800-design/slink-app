import { ForbiddenException } from '@nestjs/common';
import { AttendanceStatus, FeeStatus, Prisma, Role } from '@prisma/client';
import { ParentService } from './parent.service';
import type { ActiveUser } from '../../common/types/active-user.type';

const TENANT = 'tenant-a';
const PARENT: ActiveUser = { id: 'parent-1', tenantId: TENANT, role: Role.parent, name: 'P', isVerified: true };
const STUDENT = {
  id: 's1',
  name: 'Avyaan Singha',
  classId: 'class-1',
  class: { id: 'class-1', name: 'Class 1', section: 'A' },
};

const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const fee = (id: string, due: number, paid: number, dueDate: string, name = 'Term 2') => ({
  id,
  amountDue: new Prisma.Decimal(due),
  amountPaid: new Prisma.Decimal(paid),
  dueDate: dbDate(dueDate),
  feeStructure: { name },
});

function makePrisma() {
  return {
    tenant: { findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Kolkata' }) },
    studentParent: { findFirst: jest.fn().mockResolvedValue({ student: STUDENT }) },
    studentFee: { findMany: jest.fn().mockResolvedValue([]) },
    paymentClaim: { findMany: jest.fn().mockResolvedValue([]) },
    report: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceRecord: { groupBy: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe('ParentService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let reports: { homeworkAttachmentUrl: jest.Mock };
  let service: ParentService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T06:30:00.000Z')); // 12:00 IST, 08/10/2026
    prisma = makePrisma();
    reports = { homeworkAttachmentUrl: jest.fn().mockResolvedValue('https://signed.example/photo.jpg') };
    service = new ParentService(prisma as never, reports as never);
  });

  afterEach(() => jest.useRealTimers());

  it("refuses a child that isn't the caller's own", async () => {
    prisma.studentParent.findFirst.mockResolvedValue(null);
    await expect(service.getHome(TENANT, 's-other', PARENT)).rejects.toThrow(ForbiddenException);
    expect(prisma.studentParent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's-other', parentId: PARENT.id, student: { tenantId: TENANT } } }),
    );
  });

  describe('fee card', () => {
    it('shows the earliest unpaid fee, total outstanding and overdue state', async () => {
      prisma.studentFee.findMany.mockResolvedValue([
        fee('f1', 6000, 0, '2026-10-05', 'Term 1'),
        fee('f2', 8000, 2000, '2026-12-15'),
      ]);

      const { fees } = await service.getHome(TENANT, 's1', PARENT);

      expect(fees).toMatchObject({
        totalOutstanding: 12000,
        openCount: 2,
        overdue: true,
        next: { studentFeeId: 'f1', name: 'Term 1', outstanding: 6000, dueDate: '2026-10-05', overdue: true },
        claimUnderReview: null,
      });
      expect(prisma.studentFee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT, studentId: 's1', status: { notIn: [FeeStatus.paid, FeeStatus.waived] } } }),
      );
    });

    it('reports nothing due when every balance is cleared', async () => {
      prisma.studentFee.findMany.mockResolvedValue([fee('f1', 6000, 6000, '2026-10-15')]);
      const { fees } = await service.getHome(TENANT, 's1', PARENT);
      expect(fees).toMatchObject({ totalOutstanding: 0, openCount: 0, overdue: false, next: null });
    });

    it('surfaces a pending payment claim', async () => {
      prisma.studentFee.findMany.mockResolvedValue([fee('f1', 6000, 0, '2026-10-15')]);
      prisma.paymentClaim.findMany.mockResolvedValue([{ claimedAmount: new Prisma.Decimal(6000), studentFeeId: 'f1' }]);
      const { fees } = await service.getHome(TENANT, 's1', PARENT);
      expect(fees.claimUnderReview).toEqual({ count: 1, amount: 6000 });
    });
  });

  it("lists only today's homework (school timezone) with teacher name and a fresh photo link", async () => {
    prisma.report.findMany.mockResolvedValue([
      // 08/10 09:00 IST — today
      { id: 'h1', content: { caption: 'Maths p.12', fileKey: 'k1' }, publishedAt: new Date('2026-10-08T03:30:00Z'), teacher: { name: 'Neha' } },
      // 07/10 23:00 IST (17:30Z) — yesterday in the school's timezone, so excluded
      { id: 'h0', content: { caption: 'Old' }, publishedAt: new Date('2026-10-07T17:30:00Z'), teacher: { name: 'Neha' } },
    ]);

    const { homework } = await service.getHome(TENANT, 's1', PARENT);

    expect(homework).toEqual([
      expect.objectContaining({ id: 'h1', caption: 'Maths p.12', teacherName: 'Neha', subject: null, photoUrl: 'https://signed.example/photo.jpg' }),
    ]);
  });

  it("filters notices to the child's class plus school-wide ones", async () => {
    const at = (iso: string) => new Date(iso);
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n3', title: 'Other class', body: 'x', data: { type: 'notice', classId: 'class-9' }, createdAt: at('2026-10-08T05:00:00Z') },
      { id: 'n2', title: 'PTM', body: 'Sat 10am', data: { type: 'notice', classId: 'class-1' }, createdAt: at('2026-10-07T05:00:00Z') },
      { id: 'n1', title: 'Holiday', body: 'Closed Fri', data: { type: 'notice' }, createdAt: at('2026-10-06T05:00:00Z') },
    ]);

    const notices = await service.getNotices(TENANT, 's1', PARENT);
    const home = await service.getHome(TENANT, 's1', PARENT);

    expect(notices.map((n) => n.id)).toEqual(['n2', 'n1']);
    expect(home.latestNotice?.id).toBe('n2');
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT, userId: PARENT.id, data: { path: ['type'], equals: 'notice' } } }),
    );
  });

  it('gives month attendance and today status', async () => {
    prisma.attendanceRecord.groupBy.mockResolvedValue([
      { status: AttendanceStatus.present, _count: { _all: 20 } },
      { status: AttendanceStatus.late, _count: { _all: 1 } },
      { status: AttendanceStatus.absent, _count: { _all: 1 } },
    ]);
    prisma.attendanceRecord.findUnique.mockResolvedValue({ status: AttendanceStatus.absent });

    const { attendance } = await service.getHome(TENANT, 's1', PARENT);

    expect(attendance).toEqual({ month: { daysPresent: 21, daysMarked: 22, percentage: 95.5 }, todayStatus: 'absent' });
  });
});
