import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { daysFromTo, groupQuote } from '../../common/subscription';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';
import { subscriptionView, tenantSelect } from '../tenants/tenants.service';
import { SchoolFacts, buildDashboard } from './platform-insights';

const DAY = 86_400_000;

/** Gathers per-school facts for the platform dashboard (super_admin). */
@Injectable()
export class PlatformDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const today = todayIn('Asia/Kolkata');
    const weekAgo = toDbDate(
      fromDbDate(new Date(Date.parse(`${today}T00:00:00Z`) - 7 * DAY)),
    );
    const [
      tenants,
      staff,
      appUse,
      attendance,
      leads7,
      leads30,
      pricing7,
      pricing30,
      groups,
    ] = await Promise.all([
      this.prisma.tenant.findMany({ select: tenantSelect }),
      this.prisma.user.groupBy({
        by: ['tenantId'],
        where: { role: { in: [Role.teacher, Role.admin, Role.accounts] } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ tenant_id: string; n: number }[]>`
        SELECT s.tenant_id, COUNT(DISTINCT s.id)::int AS n
        FROM students s
        JOIN student_parents sp ON sp.student_id = s.id
        JOIN users u ON u.id = sp.parent_id
        WHERE cardinality(u.fcm_tokens) > 0
        GROUP BY s.tenant_id`,
      this.prisma.attendanceRecord.groupBy({
        by: ['tenantId'],
        where: { date: { gte: weekAgo } },
        _count: { _all: true },
      }),
      this.prisma.contactRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * DAY) } },
      }),
      this.prisma.contactRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
      }),
      this.prisma.pricingRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * DAY) } },
      }),
      this.prisma.pricingRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * DAY) } },
      }),
      this.prisma.schoolGroup.findMany({
        select: { _count: { select: { tenants: true } } },
      }),
    ]);
    // Head office fees of school groups (docs/SPEC-franchise.md §5).
    const headOfficeFees = groups.reduce(
      (t, g) =>
        t +
        groupQuote(
          Array.from({ length: g._count.tenants }, (_, i) => ({
            id: String(i),
            name: '',
            plan: 'premium' as const,
            students: 0,
          })),
        ).headOfficeFee,
      0,
    );
    const staffBy = new Map(staff.map((s) => [s.tenantId, s._count._all]));
    const appBy = new Map(appUse.map((a) => [a.tenant_id, a.n]));
    const attBy = new Map(attendance.map((a) => [a.tenantId, a._count._all]));

    const facts: SchoolFacts[] = tenants.map((t) => {
      const sub = subscriptionView(t);
      return {
        id: t.id,
        name: t.name,
        isActive: t.isActive,
        ageDays: daysFromTo(fromDbDate(t.createdAt), today),
        plan: t.subscriptionPlan,
        features: (t.features ?? {}) as Record<string, unknown>,
        status: sub.status,
        daysLeft: sub.daysLeft,
        yearlyTotal: sub.yearlyAmount.total,
        addOns: sub.addOns,
        students: t._count.students,
        staff: staffBy.get(t.id) ?? 0,
        studentsWithAppParent: appBy.get(t.id) ?? 0,
        attendanceLast7: attBy.get(t.id) ?? 0,
      };
    });
    return {
      today,
      ...buildDashboard(
        facts,
        { last7: leads7 + pricing7, last30: leads30 + pricing30 },
        headOfficeFees,
      ),
    };
  }
}
