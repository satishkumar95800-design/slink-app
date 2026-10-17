import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  PLAN_LABEL,
  SubscriptionStatus,
  addDays,
  subscriptionState,
} from '../../common/subscription';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';

const err = (code: string, message: string) => ({ code, message });

/** Plans that include the head office view (docs/SPEC-subscriptions.md 6). */
const INCLUDED: SubscriptionPlan[] = ['premium', 'premium_max'];
const STAFF: Role[] = [Role.teacher, Role.admin, Role.accounts];

const branchSelect = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  isActive: true,
  features: true,
  subscriptionPlan: true,
  subscriptionEndsOn: true,
  _count: { select: { students: true } },
} satisfies Prisma.TenantSelect;
type BranchRow = Prisma.TenantGetPayload<{ select: typeof branchSelect }>;

interface AttendanceCounts {
  present: number;
  late: number;
  absent: number;
  leave: number;
}
const emptyCounts = (): AttendanceCounts => ({
  present: 0,
  late: 0,
  absent: 0,
  leave: 0,
});
const marked = (c: AttendanceCounts) => c.present + c.late + c.absent + c.leave;
/** Present (incl. late) out of marked, one decimal; null when nothing is marked. */
const attendancePct = (c: AttendanceCounts) =>
  marked(c) === 0
    ? null
    : Math.round(((c.present + c.late) / marked(c)) * 1000) / 10;
const pct = (n: number, d: number) =>
  d === 0 ? null : Math.round((n / d) * 1000) / 10;

export interface BranchMetrics {
  students: number;
  staff: number;
  attendanceToday: { pct: number | null; marked: number };
  attendance30: number | null;
  fees: {
    academicYear: string | null;
    collected: number;
    outstanding: number;
    collectionPct: number | null;
    overdueCount: number;
  };
  noticesLast30: number;
  appUsePct: number | null;
  syllabus: {
    planned: number;
    onTime: number;
    onTimePct: number | null;
  } | null;
}

/**
 * Head office (franchise) view: read-only numbers for the schools of the
 * signed-in user's group. The group always comes from the user's own row,
 * never from the request; a branch outside it answers 404.
 */
@Injectable()
export class HeadOfficeService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: ActiveUser) {
    const group = await this.groupOf(user);
    if (!group) return { group: null, totals: null, branches: [] };
    const branches = await this.prisma.tenant.findMany({
      where: { groupId: group.id },
      select: branchSelect,
      orderBy: { name: 'asc' },
    });
    const live = branches.filter((b) => this.access(b).available);
    const metrics = await this.metrics(live);

    const rows = branches.map((b) => {
      const a = this.access(b);
      return {
        id: b.id,
        name: b.name,
        plan: b.subscriptionPlan,
        planName: PLAN_LABEL[b.subscriptionPlan],
        included: a.included,
        status: a.status,
        available: a.available,
        metrics: a.available ? metrics.get(b.id)! : null,
      };
    });
    const m = live.map((b) => metrics.get(b.id)!);
    const sum = (f: (x: BranchMetrics) => number) =>
      m.reduce((t, x) => t + f(x), 0);
    const collected = sum((x) => x.fees.collected);
    const outstanding = sum((x) => x.fees.outstanding);
    return {
      group: { id: group.id, name: group.name },
      totals: {
        branches: branches.length,
        available: live.length,
        students: sum((x) => x.students),
        staff: sum((x) => x.staff),
        collected,
        outstanding,
        collectionPct: pct(collected, collected + outstanding),
        overdueCount: sum((x) => x.fees.overdueCount),
        noticesLast30: sum((x) => x.noticesLast30),
      },
      branches: rows,
    };
  }

  /** One branch in more detail: by class, monthly collection and the attendance trend. */
  async branch(user: ActiveUser, tenantId: string) {
    const group = await this.groupOf(user);
    const b = group
      ? await this.prisma.tenant.findFirst({
          where: { id: tenantId, groupId: group.id },
          select: branchSelect,
        })
      : null;
    if (!b)
      throw new NotFoundException(
        err('BRANCH_NOT_IN_GROUP', 'This school is not part of your group'),
      );
    const a = this.access(b);
    const base = {
      id: b.id,
      name: b.name,
      plan: b.subscriptionPlan,
      planName: PLAN_LABEL[b.subscriptionPlan],
      included: a.included,
      status: a.status,
      available: a.available,
    };
    if (!a.available)
      return {
        ...base,
        metrics: null,
        classes: [],
        monthlyCollection: [],
        attendanceTrend: [],
      };

    const today = todayIn(b.timezone || 'Asia/Kolkata');
    const from30 = addDays(today, -29);
    const [metrics, classes, attByClass, feesByClass, monthly, daily] =
      await Promise.all([
        this.metrics([b]).then((x) => x.get(b.id)!),
        this.prisma.class.findMany({
          where: { tenantId: b.id, students: { some: {} } },
          select: {
            id: true,
            name: true,
            section: true,
            _count: { select: { students: true } },
          },
          orderBy: [{ name: 'asc' }, { section: 'asc' }],
        }),
        this.prisma.attendanceRecord.groupBy({
          by: ['classId', 'status'],
          where: {
            tenantId: b.id,
            date: { gte: toDbDate(from30), lte: toDbDate(today) },
          },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          {
            class_id: string;
            paid: Prisma.Decimal | null;
            outstanding: Prisma.Decimal | null;
          }[]
        >`
        WITH latest AS (
          SELECT MAX(academic_year) AS ay FROM fee_structures WHERE tenant_id = ${b.id}::uuid
        )
        SELECT s.class_id,
               SUM(sf.amount_paid) AS paid,
               SUM(GREATEST(sf.amount_due - sf.amount_paid, 0)) FILTER (WHERE sf.status <> 'waived') AS outstanding
        FROM student_fees sf
        JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        JOIN students s ON s.id = sf.student_id
        WHERE sf.tenant_id = ${b.id}::uuid AND fs.academic_year = (SELECT ay FROM latest)
        GROUP BY s.class_id`,
        this.prisma.$queryRaw<{ month: string; amount: Prisma.Decimal }[]>`
        SELECT to_char(date_trunc('month', paid_on), 'YYYY-MM') AS month, SUM(amount) AS amount
        FROM receipts
        WHERE tenant_id = ${b.id}::uuid AND paid_on >= ${toDbDate(`${addDays(today, -183).slice(0, 7)}-01`)}
        GROUP BY 1 ORDER BY 1`,
        this.prisma.attendanceRecord.groupBy({
          by: ['date', 'status'],
          where: {
            tenantId: b.id,
            date: { gte: toDbDate(from30), lte: toDbDate(today) },
          },
          _count: { _all: true },
        }),
      ]);

    const countsBy = <K extends string>(
      rows: { status: string; _count: { _all: number } }[],
      key: (r: never) => K,
    ) => {
      const map = new Map<K, AttendanceCounts>();
      for (const r of rows) {
        const k = key(r as never);
        const c = map.get(k) ?? emptyCounts();
        c[r.status as keyof AttendanceCounts] += r._count._all;
        map.set(k, c);
      }
      return map;
    };
    const attClass = countsBy(
      attByClass,
      (r: { classId: string }) => r.classId,
    );
    const attDay = countsBy(daily, (r: { date: Date }) => fromDbDate(r.date));
    const feeClass = new Map(feesByClass.map((f) => [f.class_id, f]));

    return {
      ...base,
      metrics,
      classes: classes.map((c) => {
        const f = feeClass.get(c.id);
        const paid = Number(f?.paid ?? 0);
        const out = Number(f?.outstanding ?? 0);
        return {
          id: c.id,
          name: [c.name, c.section].filter(Boolean).join(' '),
          students: c._count.students,
          attendance30: attendancePct(attClass.get(c.id) ?? emptyCounts()),
          collected: paid,
          outstanding: out,
          collectionPct: pct(paid, paid + out),
        };
      }),
      monthlyCollection: monthly.map((m) => ({
        month: m.month,
        amount: Number(m.amount),
      })),
      attendanceTrend: [...attDay.entries()]
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([date, c]) => ({
          date,
          pct: attendancePct(c),
          marked: marked(c),
        })),
    };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** The signed-in head office user's group, read from their own row. */
  private async groupOf(user: ActiveUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, group: { select: { id: true, name: true } } },
    });
    return row?.role === Role.head_office ? row.group : null;
  }

  /** Included in the branch's plan, and not switched off. */
  private access(b: BranchRow): {
    included: boolean;
    status: SubscriptionStatus;
    available: boolean;
  } {
    const { status } = subscriptionState(
      fromDbDate(b.subscriptionEndsOn),
      todayIn(b.timezone || 'Asia/Kolkata'),
    );
    const included = INCLUDED.includes(b.subscriptionPlan);
    return {
      included,
      status,
      available: included && b.isActive && status !== 'expired',
    };
  }

  /** Headline numbers for several branches in a few grouped queries. */
  private async metrics(
    branches: BranchRow[],
  ): Promise<Map<string, BranchMetrics>> {
    const out = new Map<string, BranchMetrics>();
    if (branches.length === 0) return out;
    const ids = branches.map((b) => b.id);
    const todayOf = new Map(
      branches.map((b) => [b.id, todayIn(b.timezone || 'Asia/Kolkata')]),
    );
    const days = [...new Set(todayOf.values())];
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const earliest = days.sort()[0];

    const [staff, attToday, att30, fees, notices, appUse, syllabus] =
      await Promise.all([
        this.prisma.user.groupBy({
          by: ['tenantId'],
          where: { tenantId: { in: ids }, role: { in: STAFF } },
          _count: { _all: true },
        }),
        this.prisma.attendanceRecord.groupBy({
          by: ['tenantId', 'date', 'status'],
          where: { tenantId: { in: ids }, date: { in: days.map(toDbDate) } },
          _count: { _all: true },
        }),
        this.prisma.attendanceRecord.groupBy({
          by: ['tenantId', 'status'],
          where: {
            tenantId: { in: ids },
            date: { gte: toDbDate(addDays(earliest, -29)) },
          },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          {
            tenant_id: string;
            ay: string;
            paid: Prisma.Decimal | null;
            outstanding: Prisma.Decimal | null;
            overdue: number;
          }[]
        >`
        WITH latest AS (
          SELECT tenant_id, MAX(academic_year) AS ay
          FROM fee_structures WHERE tenant_id = ANY(${ids}::uuid[]) GROUP BY tenant_id
        )
        SELECT sf.tenant_id, l.ay,
               SUM(sf.amount_paid) AS paid,
               SUM(GREATEST(sf.amount_due - sf.amount_paid, 0)) FILTER (WHERE sf.status <> 'waived') AS outstanding,
               COUNT(*) FILTER (WHERE sf.status NOT IN ('waived', 'paid') AND sf.due_date < CURRENT_DATE AND sf.amount_due > sf.amount_paid)::int AS overdue
        FROM student_fees sf
        JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        JOIN latest l ON l.tenant_id = fs.tenant_id AND l.ay = fs.academic_year
        GROUP BY sf.tenant_id, l.ay`,
        this.prisma.broadcast.groupBy({
          by: ['tenantId'],
          where: {
            tenantId: { in: ids },
            kind: 'notice',
            createdAt: { gte: since30 },
          },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<{ tenant_id: string; n: number }[]>`
        SELECT s.tenant_id, COUNT(DISTINCT s.id)::int AS n
        FROM students s
        JOIN student_parents sp ON sp.student_id = s.id
        JOIN users u ON u.id = sp.parent_id
        WHERE s.tenant_id = ANY(${ids}::uuid[]) AND cardinality(u.fcm_tokens) > 0
        GROUP BY s.tenant_id`,
        this.prisma.$queryRaw<
          { tenant_id: string; planned: number; late: number }[]
        >`
        SELECT tenant_id,
               COUNT(DISTINCT (class_id, subject_id))::int AS planned,
               COUNT(DISTINCT (class_id, subject_id)) FILTER (WHERE completed_on IS NULL AND planned_by < CURRENT_DATE)::int AS late
        FROM syllabus_topics WHERE tenant_id = ANY(${ids}::uuid[])
        GROUP BY tenant_id`,
      ]);

    const staffBy = new Map(staff.map((s) => [s.tenantId, s._count._all]));
    const noticesBy = new Map(notices.map((n) => [n.tenantId, n._count._all]));
    const appBy = new Map(appUse.map((a) => [a.tenant_id, a.n]));
    const feesBy = new Map(fees.map((f) => [f.tenant_id, f]));
    const sylBy = new Map(syllabus.map((s) => [s.tenant_id, s]));
    const todayCounts = new Map<string, AttendanceCounts>();
    for (const r of attToday) {
      if (fromDbDate(r.date) !== todayOf.get(r.tenantId)) continue;
      const c = todayCounts.get(r.tenantId) ?? emptyCounts();
      c[r.status] += r._count._all;
      todayCounts.set(r.tenantId, c);
    }
    const counts30 = new Map<string, AttendanceCounts>();
    for (const r of att30) {
      const c = counts30.get(r.tenantId) ?? emptyCounts();
      c[r.status] += r._count._all;
      counts30.set(r.tenantId, c);
    }

    for (const b of branches) {
      const f = feesBy.get(b.id);
      const paid = Number(f?.paid ?? 0);
      const outstanding = Number(f?.outstanding ?? 0);
      const t = todayCounts.get(b.id) ?? emptyCounts();
      const syl = sylBy.get(b.id);
      const features = (b.features ?? {}) as Record<string, unknown>;
      out.set(b.id, {
        students: b._count.students,
        staff: staffBy.get(b.id) ?? 0,
        attendanceToday: { pct: attendancePct(t), marked: marked(t) },
        attendance30: attendancePct(counts30.get(b.id) ?? emptyCounts()),
        fees: {
          academicYear: f?.ay ?? null,
          collected: paid,
          outstanding,
          collectionPct: pct(paid, paid + outstanding),
          overdueCount: f?.overdue ?? 0,
        },
        noticesLast30: noticesBy.get(b.id) ?? 0,
        appUsePct: pct(appBy.get(b.id) ?? 0, b._count.students),
        syllabus:
          features.syllabus === true
            ? {
                planned: syl?.planned ?? 0,
                onTime: (syl?.planned ?? 0) - (syl?.late ?? 0),
                onTimePct: pct(
                  (syl?.planned ?? 0) - (syl?.late ?? 0),
                  syl?.planned ?? 0,
                ),
              }
            : null,
      });
    }
    return out;
  }
}
