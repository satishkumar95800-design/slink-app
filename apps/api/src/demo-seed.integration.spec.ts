import { PrismaClient, Role } from '@prisma/client';
import { assertSafeToReset, DEMO_SLUG, seedDemo } from '../prisma/seed-demo';
import { InsightsService } from './modules/insights/insights.service';
import { AttendanceService } from './modules/attendance/attendance.service';
import { ParentService } from './modules/parent/parent.service';
import { BroadcastsService } from './modules/broadcasts/broadcasts.service';
import { TeacherDashboardService } from './modules/teacher-dashboard/teacher-dashboard.service';
import { ReceiptsService } from './modules/receipts/receipts.service';
import type { ActiveUser } from './common/types/active-user.type';

describe('assertSafeToReset', () => {
  it('allows a fresh run or a flagged demo school, and refuses anything else', () => {
    expect(() => assertSafeToReset(null)).not.toThrow();
    expect(() =>
      assertSafeToReset({ slug: DEMO_SLUG, features: { isDemo: true } }),
    ).not.toThrow();
    expect(() => assertSafeToReset({ slug: DEMO_SLUG, features: {} })).toThrow(
      /Refusing to run/,
    );
    expect(() =>
      assertSafeToReset({ slug: DEMO_SLUG, features: { isDemo: 'true' } }),
    ).toThrow(/Refusing to run/);
  });
});

/**
 * Seeds the demo school into a real Postgres (TEST_DATABASE_URL) and runs the
 * real services' SQL against it — the dashboard numbers the demo video shows.
 */
const dbUrl = process.env.TEST_DATABASE_URL;
(dbUrl ? describe : describe.skip)('demo school against Postgres', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  const noFiles = {
    getSignedUrl: async () => 'https://files.example/x',
    keyFromUrl: () => null,
  };

  beforeAll(async () => {
    process.env.DEMO_SEED_SKIP_FILES = 'true';
    prisma = new PrismaClient({ datasourceUrl: dbUrl });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await seedDemo(prisma);
    tenantId = (
      await prisma.tenant.findUniqueOrThrow({ where: { slug: DEMO_SLUG } })
    ).id;
  }, 120_000);
  afterAll(() => prisma.$disconnect());

  const userWith = async (where: object): Promise<ActiveUser> => {
    const u = await prisma.user.findFirstOrThrow({
      where: { tenantId, ...where },
    });
    return { id: u.id, tenantId, role: u.role, name: u.name, isVerified: true };
  };

  it('dashboard fee cards land in the spec range and match the Student Fees sum', async () => {
    const totals = await new InsightsService(
      prisma as never,
      {} as never,
      {} as never,
    ).getFeeTotals(tenantId);
    expect(totals.collected).toBeGreaterThanOrEqual(18_00_000);
    expect(totals.collected).toBeLessThanOrEqual(20_00_000);
    expect(totals.outstanding).toBeGreaterThanOrEqual(3_00_000);
    expect(totals.outstanding).toBeLessThanOrEqual(4_00_000);

    const sum = await prisma.studentFee.aggregate({
      where: { tenantId },
      _sum: { amountPaid: true },
    });
    expect(totals.collected).toBe(Number(sum._sum.amountPaid));
  });

  it('Recent Payments mixes methods and tags approved claims', async () => {
    const admin = await userWith({ role: Role.admin });
    const receipts = new ReceiptsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const recent = await receipts.getRecent(tenantId, admin, 100);
    expect(new Set(recent.map((r) => r.method)).size).toBeGreaterThanOrEqual(3);
    const claimReceiptIds = (
      await prisma.paymentClaim.findMany({
        where: { tenantId, status: 'approved' },
      })
    ).map((c) => c.receiptId);
    expect(claimReceiptIds.filter(Boolean)).toHaveLength(3);
  });

  it("today's attendance shows ~92% and the unmarked classes", async () => {
    const summary = await new AttendanceService(
      prisma as never,
      {} as never,
    ).getSchoolSummary(tenantId, undefined);
    if (summary.holiday || new Date().getUTCDay() === 0) return; // nothing marked on holidays/Sundays
    expect(summary.notMarked).toHaveLength(3);
    expect(summary.percentage).toBeGreaterThan(80);
  });

  it('the demo parent sees two children, a fee due and today’s cards', async () => {
    const parent = await userWith({ phone: '+919999900001' });
    const children = await prisma.studentParent.findMany({
      where: { parentId: parent.id },
    });
    expect(children).toHaveLength(2);

    const service = new ParentService(
      prisma as never,
      { homeworkAttachmentUrls: async () => [] } as never,
      new BroadcastsService(prisma as never, noFiles as never),
    );
    const homes = await Promise.all(
      children.map((c) => service.getHome(tenantId, c.studentId, parent)),
    );
    expect(homes.some((h) => h.fees.next !== null)).toBe(true); // one child has a balance
    expect(homes.some((h) => h.fees.openCount === 0)).toBe(true); // the other is fully paid
    expect(homes.every((h) => h.attendance.month.daysMarked > 0)).toBe(true);
    expect(homes.every((h) => h.latestNotice !== null)).toBe(true);
    const notices = await service.getNotices(
      tenantId,
      children[0].studentId,
      parent,
    );
    expect(notices.some((n) => n.attachments.length === 1)).toBe(true); // the PTM circular PDF
  });

  it('the demo teacher has a timetable, workload and seen counts', async () => {
    const teacher = await userWith({ phone: '+919999900002' });
    const broadcasts = new BroadcastsService(prisma as never, noFiles as never);
    const dashboard = new TeacherDashboardService(prisma as never, broadcasts);

    const workload = await dashboard.getWorkload(tenantId);
    const mine = workload.find((w) => w.teacherId === teacher.id)!;
    expect(mine.weeklyPeriods).toBeGreaterThanOrEqual(30);
    expect(mine.classCount).toBeGreaterThan(1);

    const sent = await broadcasts.listSent(tenantId, teacher);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((s) => s.seen <= s.recipients)).toBe(true);
    expect(sent.some((s) => s.seen > 0 && s.seen < s.recipients)).toBe(true);
  });
});
