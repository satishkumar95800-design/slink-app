import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FeeStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveUser } from '../../common/types/active-user.type';
import { isFeatureEnabled } from '../../common/tenant-features';
import { toDbDate, todayIn } from '../attendance/attendance-dates';
import {
  AlertDraft,
  Reason,
  SchoolData,
  addDays,
  expectedCollections,
  runRules,
  weekday,
} from './rules';

/** How far back the snapshot looks (enough for two 20-school-day windows). */
const LOOKBACK_DAYS = 63;
/** Local hour after which the daily run happens. */
const RUN_HOUR = 6;
const TICK_MS = 30 * 60 * 1000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Pattern warnings (docs/SPEC-ai.md phase 2). Once a day per premium school:
 * load a snapshot, run the rules, upsert alerts by dedupe key, resolve the ones
 * that no longer apply, and write the Monday summary. No model calls — this is
 * plain code over the school's own data, so it costs nothing to run.
 */
@Injectable()
export class AlertsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  /** tenantId -> local date of the last run in this process. */
  private readonly lastRun = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.ALERTS_DISABLED === 'true'
    )
      return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, timezone: true, features: true },
      });
      for (const t of tenants) {
        const features = (t.features ?? {}) as Record<string, unknown>;
        if (features.aiInsights !== true) continue;
        const tz = t.timezone || 'Asia/Kolkata';
        const today = todayIn(tz, now);
        const hour = Number(
          new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            hour12: false,
          }).format(now),
        );
        if (hour < RUN_HOUR || this.lastRun.get(t.id) === today) continue;
        try {
          await this.runForTenant(t.id, now);
          this.lastRun.set(t.id, today);
        } catch (err) {
          this.logger.error(
            `Alerts failed for ${t.id}: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  /** One full run for a school. Returns how many alerts are open afterwards. */
  async runForTenant(
    tenantId: string,
    now = new Date(),
  ): Promise<{ open: number }> {
    const data = await this.loadSnapshot(tenantId, now);
    const drafts = runRules(data);
    await this.persist(tenantId, drafts);
    if (weekday(data.today) === 1)
      await this.writeWeeklySummary(tenantId, data);
    const open = await this.prisma.insightAlert.count({
      where: { tenantId, status: 'open', kind: { not: 'weekly_summary' } },
    });
    return { open };
  }

  // ── Read / dismiss ─────────────────────────────────────────────────────────

  /** Admins see everything; accounts their money alerts; teachers their own students. */
  async listOpen(tenantId: string, user: ActiveUser) {
    const where: Prisma.InsightAlertWhereInput = {
      tenantId,
      status: 'open',
      kind: { not: 'weekly_summary' },
    };
    if (user.role === Role.accounts) where.audience = 'accounts';
    if (user.role === Role.teacher)
      Object.assign(where, { audience: 'teacher', teacherId: user.id });
    const rows = await this.prisma.insightAlert.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
    const rank = { critical: 0, warning: 1, info: 2 } as Record<string, number>;
    return rows.sort(
      (a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3),
    );
  }

  async dismiss(tenantId: string, id: string, user: ActiveUser) {
    const alert = await this.prisma.insightAlert.findUnique({ where: { id } });
    if (!alert || alert.tenantId !== tenantId)
      throw new NotFoundException('Alert not found');
    if (user.role === Role.teacher && alert.teacherId !== user.id) {
      throw new NotFoundException('Alert not found');
    }
    if (user.role === Role.accounts && alert.audience !== 'accounts') {
      throw new NotFoundException('Alert not found');
    }
    await this.prisma.insightAlert.update({
      where: { id },
      data: { status: 'dismissed', dismissedAt: new Date() },
    });
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Upsert by dedupe key. A dismissed alert stays dismissed while it keeps
   * matching (no nagging); one that stops matching is resolved, and comes back
   * as new if the pattern returns later.
   */
  private async persist(tenantId: string, drafts: AlertDraft[]) {
    const keys = drafts.map((d) => d.dedupeKey);
    const existing = await this.prisma.insightAlert.findMany({
      where: { tenantId, kind: { not: 'weekly_summary' } },
      select: { id: true, dedupeKey: true, status: true },
    });
    const byKey = new Map(existing.map((e) => [e.dedupeKey, e]));

    for (const d of drafts) {
      const row = {
        kind: d.kind,
        severity: d.severity,
        subjectType: d.subjectType,
        subjectId: d.subjectId ?? null,
        subjectName: d.subjectName ?? null,
        reasons: d.reasons as unknown as Prisma.InputJsonValue,
        audience: d.audience,
        teacherId: d.teacherId ?? null,
      };
      const prev = byKey.get(d.dedupeKey);
      if (!prev) {
        await this.prisma.insightAlert.create({
          data: { tenantId, dedupeKey: d.dedupeKey, ...row },
        });
      } else {
        await this.prisma.insightAlert.update({
          where: { id: prev.id },
          data: {
            ...row,
            status: prev.status === 'resolved' ? 'open' : prev.status,
          },
        });
      }
    }

    const gone = existing.filter(
      (e) => e.status === 'open' && !keys.includes(e.dedupeKey),
    );
    if (gone.length) {
      await this.prisma.insightAlert.updateMany({
        where: { id: { in: gone.map((g) => g.id) } },
        data: { status: 'resolved' },
      });
    }
  }

  /** Monday summary for admins (docs/SPEC-ai.md 1.4), stored as one alert per week. */
  private async writeWeeklySummary(tenantId: string, data: SchoolData) {
    const lastMonday = addDays(data.today, -7);
    const week = (from: string, to: string) => {
      const r = data.attendance.filter((a) => a.date >= from && a.date < to);
      const ok = r.filter(
        (a) => a.status === 'present' || a.status === 'late',
      ).length;
      return r.length ? Math.round((ok / r.length) * 100) : null;
    };
    const thisWeek = week(lastMonday, data.today);
    const prevWeek = week(addDays(lastMonday, -7), lastMonday);

    const [collected, alerts] = await Promise.all([
      this.prisma.receipt.aggregate({
        where: {
          tenantId,
          paidOn: { gte: toDbDate(lastMonday), lt: toDbDate(data.today) },
        },
        _sum: { amount: true },
      }),
      this.prisma.insightAlert.groupBy({
        by: ['severity'],
        where: { tenantId, status: 'open', kind: { not: 'weekly_summary' } },
        _count: { _all: true },
      }),
    ]);
    const overdue = data.fees
      .filter((f) => f.dueDate < data.today)
      .reduce((n, f) => n + f.outstanding, 0);
    const forecast = expectedCollections(data);
    const count = (s: string) =>
      alerts.find((a) => a.severity === s)?._count._all ?? 0;
    const notMarked = await this.prisma.insightAlert.count({
      where: { tenantId, status: 'open', kind: 'class_not_marked' },
    });

    const reasons: Reason[] = [];
    if (thisWeek !== null) {
      reasons.push(
        prevWeek === null
          ? { key: 'summary_attendance', params: { pct: thisWeek } }
          : {
              key: 'summary_attendance_change',
              params: { pct: thisWeek, change: thisWeek - prevWeek },
            },
      );
    }
    reasons.push({
      key: 'summary_collected',
      params: { amount: Math.round(Number(collected._sum.amount ?? 0)) },
    });
    reasons.push({
      key: 'summary_overdue',
      params: { amount: Math.round(overdue) },
    });
    if (forecast.due > 0) {
      reasons.push({
        key: 'summary_expected',
        params: { expected: forecast.expected, due: forecast.due },
      });
    }
    reasons.push({
      key: 'summary_alerts',
      params: {
        critical: count('critical'),
        warning: count('warning'),
        info: count('info'),
      },
    });
    if (notMarked > 0)
      reasons.push({
        key: 'summary_not_marked',
        params: { classes: notMarked },
      });

    const dedupeKey = `weekly_summary:${data.today}`;
    await this.prisma.insightAlert.upsert({
      where: { tenantId_dedupeKey: { tenantId, dedupeKey } },
      create: {
        tenantId,
        dedupeKey,
        kind: 'weekly_summary',
        severity: 'info',
        subjectType: 'school',
        reasons: reasons as unknown as Prisma.InputJsonValue,
        audience: 'admin',
      },
      update: { reasons: reasons as unknown as Prisma.InputJsonValue },
    });
  }

  /** The latest Monday summary, if any. */
  async latestSummary(tenantId: string) {
    return this.prisma.insightAlert.findFirst({
      where: { tenantId, kind: 'weekly_summary' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isEnabled(tenantId: string) {
    return isFeatureEnabled(this.prisma, tenantId, 'aiInsights');
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────

  async loadSnapshot(tenantId: string, now: Date): Promise<SchoolData> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const tz = tenant?.timezone || 'Asia/Kolkata';
    const today = todayIn(tz, now);
    const from = addDays(today, -LOOKBACK_DAYS);
    const since = toDbDate(from);
    const hourFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    });

    const [
      students,
      classes,
      attendance,
      holidays,
      notes,
      notices,
      fees,
      payments,
      receipts,
      concessions,
      slots,
    ] = await Promise.all([
      this.prisma.student.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          classId: true,
          parents: { select: { parentId: true } },
        },
      }),
      this.prisma.class.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          section: true,
          teachers: {
            where: { isClassTeacher: true },
            select: { teacherId: true },
          },
          _count: { select: { students: true } },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { tenantId, date: { gte: since } },
        select: { studentId: true, classId: true, date: true, status: true },
      }),
      this.prisma.schoolHoliday.findMany({
        where: { tenantId, date: { gte: since } },
        select: { date: true },
      }),
      this.prisma.studentNote.findMany({
        where: { tenantId, createdAt: { gte: since } },
        select: { studentId: true, type: true, createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: {
          tenantId,
          broadcastId: { not: null },
          createdAt: { gte: since },
          user: { role: Role.parent },
        },
        select: { userId: true, createdAt: true, seenAt: true },
      }),
      this.prisma.studentFee.findMany({
        where: {
          tenantId,
          status: {
            in: [FeeStatus.pending, FeeStatus.partial, FeeStatus.overdue],
          },
        },
        select: {
          id: true,
          studentId: true,
          dueDate: true,
          amountDue: true,
          amountPaid: true,
        },
      }),
      this.prisma.receipt.findMany({
        where: { tenantId, paidOn: { gte: toDbDate(addDays(today, -365)) } },
        select: {
          studentId: true,
          paidOn: true,
          studentFee: { select: { dueDate: true } },
        },
      }),
      this.prisma.receipt.findMany({
        where: {
          tenantId,
          createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
        },
        select: {
          receiptNumber: true,
          reference: true,
          recordedBy: true,
          createdAt: true,
        },
      }),
      this.prisma.feeConcession.findMany({
        where: { tenantId, givenOn: { gte: since } },
        select: { createdById: true, amount: true, givenOn: true },
      }),
      this.prisma.timetableSlot.groupBy({
        by: ['teacherId'],
        where: { tenantId },
        _count: { _all: true },
      }),
    ]);

    const staffIds = [
      ...new Set([
        ...receipts.map((r) => r.recordedBy).filter((x): x is string => !!x),
        ...concessions.map((c) => c.createdById),
        ...slots.map((s) => s.teacherId),
      ]),
    ];
    const staff = staffIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: staffIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));

    const holidaySet = new Set(holidays.map((h) => ymd(h.date)));
    const schoolDays: string[] = [];
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (weekday(d) !== 7 && !holidaySet.has(d)) schoolDays.push(d);
    }

    return {
      today,
      schoolDays,
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        classId: s.classId,
        parentIds: s.parents.map((p) => p.parentId),
      })),
      classes: classes.map((c) => ({
        id: c.id,
        name: [c.name, c.section].filter(Boolean).join(' '),
        classTeacherIds: c.teachers.map((t) => t.teacherId),
        studentCount: c._count.students,
      })),
      attendance: attendance.map((a) => ({
        studentId: a.studentId,
        classId: a.classId,
        date: ymd(a.date),
        status: a.status,
      })),
      notes: notes.map((n) => ({
        studentId: n.studentId,
        type: n.type,
        date: todayIn(tz, n.createdAt),
      })),
      parentNotices: notices.map((n) => ({
        userId: n.userId,
        date: n.createdAt.toISOString(),
        seen: n.seenAt !== null,
      })),
      fees: fees.map((f) => ({
        id: f.id,
        studentId: f.studentId,
        dueDate: ymd(f.dueDate),
        outstanding: Number(f.amountDue.sub(f.amountPaid)),
      })),
      payments: payments.map((p) => ({
        studentId: p.studentId,
        dueDate: ymd(p.studentFee.dueDate),
        paidOn: ymd(p.paidOn),
      })),
      receipts: receipts.map((r) => ({
        receiptNumber: r.receiptNumber,
        reference: r.reference,
        recordedBy: r.recordedBy,
        recordedByName: r.recordedBy
          ? (nameOf.get(r.recordedBy) ?? null)
          : null,
        enteredHour: Number(hourFmt.format(r.createdAt)),
        date: todayIn(tz, r.createdAt),
      })),
      concessions: concessions.map((c) => ({
        createdById: c.createdById,
        createdByName: nameOf.get(c.createdById) ?? '',
        amount: Number(c.amount),
        date: ymd(c.givenOn),
      })),
      teacherLoad: slots.map((s) => ({
        teacherId: s.teacherId,
        name: nameOf.get(s.teacherId) ?? '',
        weeklyPeriods: s._count._all,
      })),
    };
  }
}
