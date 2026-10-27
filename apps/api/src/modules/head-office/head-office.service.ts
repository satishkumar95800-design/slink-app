import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel,
  Prisma,
  Role,
  SubscriptionPlan,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import {
  PLAN_LABEL,
  SubscriptionStatus,
  addDays,
  subscriptionState,
} from '../../common/subscription';
import { fromDbDate, todayIn, toDbDate } from '../attendance/attendance-dates';
import { academicYearStart, Funnel } from '../admissions/admissions.math';
import { funnelFor } from '../admissions/admissions.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BroadcastTarget } from '../notifications/dto/broadcast-notification.dto';
import { CreateCircularDto } from './dto/groups.dto';
import type { BranchFacts } from './group-insights';

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
  onTrial: true,
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
  /** Attendance marked by the group's cutoff today (docs/SPEC-franchise.md §2). */
  compliance: {
    state: 'holiday' | 'done' | 'pending' | 'late';
    classes: number;
    notMarked: number;
  };
  /** This academic year's admissions funnel, when the school uses admissions. */
  admissions: Funnel | null;
}

/** One branch on the overview: plan access, and its numbers when it has data. */
export interface BranchOverview {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  planName: string;
  included: boolean;
  status: SubscriptionStatus;
  available: boolean;
  metrics: BranchMetrics | null;
}

/** HH:MM now in a timezone. */
const nowIn = (timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());

const isSunday = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).getUTCDay() === 0;

/**
 * Head office (franchise) view: read-only numbers for the schools of the
 * signed-in user's group. The group always comes from the user's own row,
 * never from the request; a branch outside it answers 404.
 */
@Injectable()
export class HeadOfficeService {
  private readonly logger = new Logger(HeadOfficeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview(user: ActiveUser) {
    const group = await this.groupOf(user);
    if (!group)
      return {
        group: null,
        totals: null,
        attendanceCutoff: null,
        branches: [] as BranchOverview[],
      };
    const branches = await this.prisma.tenant.findMany({
      where: { groupId: group.id },
      select: branchSelect,
      orderBy: { name: 'asc' },
    });
    const live = branches.filter((b) => this.access(b).available);
    const metrics = await this.metrics(live, group.attendanceCutoff);

    const rows = branches.map((b): BranchOverview => {
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
        lateAttendance: m.filter((x) => x.compliance.state === 'late').length,
        enquiries: sum((x) => x.admissions?.enquiries ?? 0),
        enrolled: sum((x) => x.admissions?.enrolled ?? 0),
      },
      attendanceCutoff: group.attendanceCutoff,
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
        this.metrics([b], group!.attendanceCutoff).then((x) => x.get(b.id)!),
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

  // ── circulars (the only thing a head office creates) ──────────────────────

  /**
   * Sends a circular to the staff (and optionally the parents) of the chosen
   * branches of the user's own group, or all of them. Only branches with data
   * (Premium / Premium Max, not switched off) receive it.
   */
  async createCircular(user: ActiveUser, dto: CreateCircularDto) {
    const group = await this.groupOf(user);
    if (!group)
      throw new NotFoundException(
        err('GROUP_NOT_FOUND', 'Your login is not linked to a group'),
      );
    const branches = await this.prisma.tenant.findMany({
      where: { groupId: group.id },
      select: branchSelect,
    });
    const wanted = dto.tenantIds?.length ? new Set(dto.tenantIds) : null;
    if (wanted && [...wanted].some((id) => !branches.some((b) => b.id === id)))
      throw new NotFoundException(
        err('BRANCH_NOT_IN_GROUP', 'This school is not part of your group'),
      );
    const targets = branches.filter(
      (b) => this.access(b).available && (!wanted || wanted.has(b.id)),
    );
    if (targets.length === 0)
      throw new BadRequestException(
        err('NO_BRANCHES', 'None of the chosen schools can receive circulars'),
      );
    const circular = await this.prisma.$transaction(async (tx) => {
      const c = await tx.groupCircular.create({
        data: {
          groupId: group.id,
          title: dto.title,
          body: dto.body,
          audience: dto.audience,
          createdBy: user.id,
          branches: { create: targets.map((b) => ({ tenantId: b.id })) },
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: null,
          actorId: user.id,
          action: 'group.circular.create',
          entityType: 'group_circular',
          entityId: c.id,
          diff: {
            groupId: group.id,
            title: dto.title,
            audience: dto.audience,
            tenantIds: targets.map((b) => b.id),
          },
        },
      });
      return c;
    });
    // Delivery can take a while (push per person); the counts fill in as it runs.
    void this.deliver(circular.id, dto, targets, user).catch((e: unknown) =>
      this.logger.error(`Circular ${circular.id} delivery failed`, e as Error),
    );
    return (await this.listCirculars(user)).find((c) => c.id === circular.id)!;
  }

  async listCirculars(user: ActiveUser) {
    const group = await this.groupOf(user);
    if (!group) return [];
    const rows = await this.prisma.groupCircular.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        branches: { include: { tenant: { select: { name: true } } } },
      },
    });
    const names = new Map(
      (
        await this.prisma.user.findMany({
          where: { id: { in: [...new Set(rows.map((r) => r.createdBy))] } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      audience: r.audience,
      createdAt: r.createdAt,
      createdBy: names.get(r.createdBy) ?? '',
      branches: r.branches.map((b) => ({
        tenantId: b.tenantId,
        name: b.tenant.name,
        staffCount: b.staffCount,
        parentCount: b.parentCount,
      })),
    }));
  }

  private async deliver(
    circularId: string,
    dto: CreateCircularDto,
    targets: BranchRow[],
    user: ActiveUser,
  ) {
    for (const b of targets) {
      const staff = await this.prisma.user.findMany({
        where: { tenantId: b.id, role: { in: STAFF } },
        select: { id: true },
      });
      for (const s of staff)
        await this.notifications.send({
          tenantId: b.id,
          userId: s.id,
          channel: NotificationChannel.fcm,
          title: dto.title,
          body: dto.body,
          data: { type: 'circular', circularId },
        });
      let parents = 0;
      if (dto.audience === 'staff_and_parents') {
        const r = await this.notifications.broadcast(
          b.id,
          {
            channel: NotificationChannel.fcm,
            title: dto.title,
            body: dto.body,
            targetType: BroadcastTarget.ALL_PARENTS,
            kind: 'notice',
          },
          user,
        );
        parents = r.queued;
      }
      await this.prisma.groupCircularBranch.update({
        where: { circularId_tenantId: { circularId, tenantId: b.id } },
        data: { staffCount: staff.length, parentCount: parents },
      });
    }
  }

  // ── for insights and royalties ───────────────────────────────────────────

  /** The group's branches that show data (plan includes it, not switched off). */
  async liveBranches(groupId: string) {
    const branches = await this.prisma.tenant.findMany({
      where: { groupId },
      select: branchSelect,
      orderBy: { name: 'asc' },
    });
    return branches.filter((b) => this.access(b).available);
  }

  /** What the insights rules need for each live branch (group-insights.ts). */
  async insightFacts(group: {
    id: string;
    attendanceCutoff: string;
  }): Promise<BranchFacts[]> {
    const live = await this.liveBranches(group.id);
    if (live.length === 0) return [];
    const ids = live.map((b) => b.id);
    const metrics = await this.metrics(live, group.attendanceCutoff);
    const today = todayIn('Asia/Kolkata');
    const d30 = toDbDate(addDays(today, -30));
    const d60 = toDbDate(addDays(today, -60));
    const [prevAttendance, money] = await Promise.all([
      this.prisma.attendanceRecord.groupBy({
        by: ['tenantId', 'status'],
        where: {
          tenantId: { in: ids },
          date: {
            gte: toDbDate(addDays(today, -59)),
            lte: toDbDate(addDays(today, -30)),
          },
        },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<
        {
          tenant_id: string;
          last30: Prisma.Decimal | null;
          prev30: Prisma.Decimal | null;
        }[]
      >`
        SELECT tenant_id,
               SUM(amount) FILTER (WHERE paid_on > ${d30}) AS last30,
               SUM(amount) FILTER (WHERE paid_on <= ${d30}) AS prev30
        FROM receipts
        WHERE tenant_id = ANY(${ids}::uuid[]) AND paid_on > ${d60}
        GROUP BY tenant_id`,
    ]);
    const prev = new Map<string, AttendanceCounts>();
    for (const r of prevAttendance) {
      const c = prev.get(r.tenantId) ?? emptyCounts();
      c[r.status] += r._count._all;
      prev.set(r.tenantId, c);
    }
    const moneyBy = new Map(money.map((m) => [m.tenant_id, m]));
    return live.map((b) => ({
      id: b.id,
      name: b.name,
      metrics: metrics.get(b.id)!,
      attendancePrev30: attendancePct(prev.get(b.id) ?? emptyCounts()),
      collectedLast30: Number(moneyBy.get(b.id)?.last30 ?? 0),
      collectedPrev30: Number(moneyBy.get(b.id)?.prev30 ?? 0),
    }));
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** The signed-in head office user's group, read from their own row. */
  async groupOf(user: ActiveUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        role: true,
        group: { select: { id: true, name: true, attendanceCutoff: true } },
      },
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
      b.onTrial,
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
    cutoff: string,
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

    const admissionIds = branches
      .filter(
        (b) => (b.features as Record<string, unknown>)?.admissions === true,
      )
      .map((b) => b.id);
    const [classStudents, markedClasses, holidays, funnels] = await Promise.all(
      [
        this.prisma.student.groupBy({
          by: ['tenantId', 'classId'],
          where: { tenantId: { in: ids } },
        }),
        this.prisma.attendanceRecord.groupBy({
          by: ['tenantId', 'classId', 'date'],
          where: { tenantId: { in: ids }, date: { in: days.map(toDbDate) } },
        }),
        this.prisma.schoolHoliday.findMany({
          where: { tenantId: { in: ids }, date: { in: days.map(toDbDate) } },
          select: { tenantId: true, date: true },
        }),
        admissionIds.length
          ? funnelFor(this.prisma, admissionIds, academicYearStart(earliest))
          : Promise.resolve(new Map<string, Funnel>()),
      ],
    );
    const classesBy = new Map<string, number>();
    for (const c of classStudents)
      classesBy.set(c.tenantId, (classesBy.get(c.tenantId) ?? 0) + 1);
    const markedBy = new Map<string, number>();
    for (const r of markedClasses)
      if (fromDbDate(r.date) === todayOf.get(r.tenantId))
        markedBy.set(r.tenantId, (markedBy.get(r.tenantId) ?? 0) + 1);
    const holidayBy = new Set(
      holidays
        .filter((h) => fromDbDate(h.date) === todayOf.get(h.tenantId))
        .map((h) => h.tenantId),
    );

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
        compliance: (() => {
          const today = todayOf.get(b.id)!;
          const classes = classesBy.get(b.id) ?? 0;
          const notMarked = Math.max(0, classes - (markedBy.get(b.id) ?? 0));
          const state: BranchMetrics['compliance']['state'] =
            isSunday(today) || holidayBy.has(b.id) || classes === 0
              ? 'holiday'
              : notMarked === 0
                ? 'done'
                : nowIn(b.timezone || 'Asia/Kolkata') >= cutoff
                  ? 'late'
                  : 'pending';
          return { state, classes, notMarked };
        })(),
        admissions: funnels.get(b.id) ?? null,
      });
    }
    return out;
  }
}
