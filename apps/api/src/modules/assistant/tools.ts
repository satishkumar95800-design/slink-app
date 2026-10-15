import { AttendanceStatus, FeeStatus, Prisma, Role } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { toDbDate } from '../attendance/attendance-dates';

/**
 * The assistant's fixed, read-only, school-scoped queries (docs/SPEC-ai.md
 * phase 3). The model only picks one and fills its arguments; the answer is
 * built here from real data and rendered by the client in the user's language
 * (headline i18n key + typed table), so nothing in it is model-generated.
 */

export type ColumnType = 'text' | 'number' | 'percent' | 'money' | 'date';

export interface ToolResult {
  tool: string;
  /** i18n key + params for the one-line answer. */
  headline: { key: string; params: Record<string, string | number> };
  /** i18n keys of column headers and how to format each. */
  columns: { key: string; type: ColumnType }[];
  rows: (string | number | null)[][];
  /** Rows beyond the cap were left out. */
  truncated?: boolean;
}

export interface ToolContext {
  prisma: PrismaService;
  tenantId: string;
  userId: string;
  role: Role;
  /** "YYYY-MM-DD" in the school's timezone. */
  today: string;
  classes: { id: string; name: string }[];
  /** Parents only: their own children. */
  children: { id: string; firstName: string; classId: string }[];
}

export interface ToolDef {
  name: string;
  /** For the model: what it answers and its arguments. */
  describe: string;
  roles: Role[];
  run(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}

const MAX_ROWS = 50;
const DAY_MS = 86_400_000;

// ── Argument helpers (the model's output is never trusted as-is) ────────────

function date(v: unknown, fallback: string): string {
  return typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v))
    ? v
    : fallback;
}
function addDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
/** The first UUID in a model-supplied value ("<id>: Vihaan" -> "<id>"). */
function uuidIn(v: unknown): string | undefined {
  return typeof v === 'string'
    ? /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(
        v,
      )?.[0]
    : undefined;
}
function classId(ctx: ToolContext, v: unknown): string | undefined {
  const id = uuidIn(v);
  return id && ctx.classes.some((c) => c.id === id) ? id : undefined;
}
/** A parent's child by id; the only child when there's one; else undefined. */
function childOf(ctx: ToolContext, v: unknown) {
  const id = uuidIn(v);
  const byId = ctx.children.find((c) => c.id === id);
  return byId ?? (ctx.children.length === 1 ? ctx.children[0] : undefined);
}
function range(
  ctx: ToolContext,
  args: Record<string, unknown>,
  defaultDays: number,
) {
  let to = date(args.to, ctx.today);
  if (to > ctx.today) to = ctx.today;
  let from = date(args.from, addDays(to, -(defaultDays - 1)));
  if (from > to) from = to;
  if (Date.parse(to) - Date.parse(from) > 366 * DAY_MS)
    from = addDays(to, -365);
  return { from, to };
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const className = (ctx: ToolContext, id: string) =>
  ctx.classes.find((c) => c.id === id)?.name ?? '';
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const attended = (s: AttendanceStatus) =>
  s === AttendanceStatus.present || s === AttendanceStatus.late;
function cap<T>(rows: T[]): { rows: T[]; truncated?: boolean } {
  return rows.length > MAX_ROWS
    ? { rows: rows.slice(0, MAX_ROWS), truncated: true }
    : { rows };
}
const UNPAID = [FeeStatus.pending, FeeStatus.partial, FeeStatus.overdue];

const STAFF: Role[] = [Role.admin];
const MONEY: Role[] = [Role.admin, Role.accounts];

// ── Staff tools ──────────────────────────────────────────────────────────────

export const STAFF_TOOLS: ToolDef[] = [
  {
    name: 'attendance_by_class',
    describe:
      'Attendance % for each class (or one class), lowest first, over a date range. E.g. "which classes have the lowest attendance", "attendance of 7B this week", "school attendance this month". Args: from, to (YYYY-MM-DD; default last 30 days), classId (optional).',
    roles: STAFF,
    async run(ctx, args) {
      const { from, to } = range(ctx, args, 30);
      const where: Prisma.AttendanceRecordWhereInput = {
        tenantId: ctx.tenantId,
        date: { gte: toDbDate(from), lte: toDbDate(to) },
        ...(classId(ctx, args.classId)
          ? { classId: classId(ctx, args.classId) }
          : {}),
      };
      const grouped = await ctx.prisma.attendanceRecord.groupBy({
        by: ['classId', 'status'],
        where,
        _count: { _all: true },
      });
      const byClass = new Map<string, { ok: number; all: number }>();
      for (const g of grouped) {
        const cur = byClass.get(g.classId) ?? { ok: 0, all: 0 };
        cur.all += g._count._all;
        if (attended(g.status)) cur.ok += g._count._all;
        byClass.set(g.classId, cur);
      }
      const rows = [...byClass]
        .map(
          ([id, c]) =>
            [className(ctx, id), pct(c.ok, c.all), c.all] as [
              string,
              number,
              number,
            ],
        )
        .sort((a, b) => a[1] - b[1]);
      const total = [...byClass.values()].reduce(
        (n, c) => ({ ok: n.ok + c.ok, all: n.all + c.all }),
        { ok: 0, all: 0 },
      );
      return {
        tool: 'attendance_by_class',
        headline: {
          key: 'attendance_overall',
          params: { pct: pct(total.ok, total.all), from, to },
        },
        columns: [
          { key: 'class', type: 'text' },
          { key: 'attendance', type: 'percent' },
          { key: 'records', type: 'number' },
        ],
        ...cap(rows),
      };
    },
  },
  {
    name: 'low_attendance_students',
    describe:
      'Students whose attendance is below a threshold over a date range. E.g. "students below 80%", "who is missing school a lot". Args: threshold (percent, default 75), from, to (default last 30 days), classId (optional).',
    roles: STAFF,
    async run(ctx, args) {
      const { from, to } = range(ctx, args, 30);
      const threshold = num(args.threshold, 75, 1, 100);
      const grouped = await ctx.prisma.attendanceRecord.groupBy({
        by: ['studentId', 'status'],
        where: {
          tenantId: ctx.tenantId,
          date: { gte: toDbDate(from), lte: toDbDate(to) },
          ...(classId(ctx, args.classId)
            ? { classId: classId(ctx, args.classId) }
            : {}),
        },
        _count: { _all: true },
      });
      const by = new Map<string, { ok: number; all: number }>();
      for (const g of grouped) {
        const cur = by.get(g.studentId) ?? { ok: 0, all: 0 };
        cur.all += g._count._all;
        if (attended(g.status)) cur.ok += g._count._all;
        by.set(g.studentId, cur);
      }
      const low = [...by].filter(([, c]) => pct(c.ok, c.all) < threshold);
      const students = await ctx.prisma.student.findMany({
        where: { tenantId: ctx.tenantId, id: { in: low.map(([id]) => id) } },
        select: { id: true, name: true, classId: true },
      });
      const info = new Map(students.map((s) => [s.id, s]));
      const rows = low
        .map(
          ([id, c]) =>
            [
              info.get(id)?.name ?? '',
              className(ctx, info.get(id)?.classId ?? ''),
              pct(c.ok, c.all),
            ] as [string, string, number],
        )
        .sort((a, b) => a[2] - b[2]);
      return {
        tool: 'low_attendance_students',
        headline: {
          key: 'low_attendance_count',
          params: { count: rows.length, threshold, from, to },
        },
        columns: [
          { key: 'student', type: 'text' },
          { key: 'class', type: 'text' },
          { key: 'attendance', type: 'percent' },
        ],
        ...cap(rows),
      };
    },
  },
  {
    name: 'absentees_on_date',
    describe:
      'Students marked absent (or on leave) on one day. E.g. "who was absent today", "absentees yesterday in class 3". Args: date (YYYY-MM-DD, default today), classId (optional).',
    roles: STAFF,
    async run(ctx, args) {
      const day = date(args.date, ctx.today);
      const records = await ctx.prisma.attendanceRecord.findMany({
        where: {
          tenantId: ctx.tenantId,
          date: toDbDate(day),
          status: { in: [AttendanceStatus.absent, AttendanceStatus.leave] },
          ...(classId(ctx, args.classId)
            ? { classId: classId(ctx, args.classId) }
            : {}),
        },
        select: {
          status: true,
          classId: true,
          student: { select: { name: true } },
        },
      });
      const rows = records
        .map(
          (r) =>
            [r.student.name, className(ctx, r.classId), r.status] as [
              string,
              string,
              string,
            ],
        )
        .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
      return {
        tool: 'absentees_on_date',
        headline: {
          key: 'absentees_count',
          params: { count: rows.length, date: day },
        },
        columns: [
          { key: 'student', type: 'text' },
          { key: 'class', type: 'text' },
          { key: 'status', type: 'text' },
        ],
        ...cap(rows),
      };
    },
  },
  {
    name: 'fee_outstanding',
    describe:
      'Students with unpaid fees and how much. E.g. "fee defaulters", "who has not paid", "pending fees in class 5". Args: classId (optional), overdueOnly (boolean, default false).',
    roles: MONEY,
    async run(ctx, args) {
      const fees = await ctx.prisma.studentFee.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: { in: UNPAID },
          ...(args.overdueOnly === true
            ? { dueDate: { lt: toDbDate(ctx.today) } }
            : {}),
          ...(classId(ctx, args.classId)
            ? { student: { classId: classId(ctx, args.classId) } }
            : {}),
        },
        select: {
          amountDue: true,
          amountPaid: true,
          dueDate: true,
          student: { select: { id: true, name: true, classId: true } },
        },
      });
      const by = new Map<
        string,
        { name: string; classId: string; amount: number; oldest: string }
      >();
      for (const f of fees) {
        const owed = Number(f.amountDue.sub(f.amountPaid));
        if (owed <= 0) continue;
        const cur = by.get(f.student.id) ?? {
          name: f.student.name,
          classId: f.student.classId,
          amount: 0,
          oldest: ymd(f.dueDate),
        };
        cur.amount += owed;
        if (ymd(f.dueDate) < cur.oldest) cur.oldest = ymd(f.dueDate);
        by.set(f.student.id, cur);
      }
      const rows = [...by.values()]
        .sort((a, b) => b.amount - a.amount)
        .map(
          (s) =>
            [
              s.name,
              className(ctx, s.classId),
              Math.round(s.amount),
              s.oldest,
            ] as [string, string, number, string],
        );
      const total = rows.reduce((n, r) => n + r[2], 0);
      return {
        tool: 'fee_outstanding',
        headline: {
          key: 'outstanding_total',
          params: { amount: total, count: rows.length },
        },
        columns: [
          { key: 'student', type: 'text' },
          { key: 'class', type: 'text' },
          { key: 'outstanding', type: 'money' },
          { key: 'oldestDue', type: 'date' },
        ],
        ...cap(rows),
      };
    },
  },
  {
    name: 'collections',
    describe:
      'Fees collected over a date range, by payment method. E.g. "collection this month", "how much was paid today". Args: from, to (default this month so far).',
    roles: MONEY,
    async run(ctx, args) {
      const monthStart = `${ctx.today.slice(0, 8)}01`;
      const { from, to } = range(
        ctx,
        { from: args.from ?? monthStart, to: args.to },
        30,
      );
      const grouped = await ctx.prisma.receipt.groupBy({
        by: ['method'],
        where: {
          tenantId: ctx.tenantId,
          paidOn: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        _sum: { amount: true },
        _count: { _all: true },
      });
      const rows = grouped
        .map(
          (g) =>
            [
              g.method,
              Math.round(Number(g._sum.amount ?? 0)),
              g._count._all,
            ] as [string, number, number],
        )
        .sort((a, b) => b[1] - a[1]);
      return {
        tool: 'collections',
        headline: {
          key: 'collected_total',
          params: {
            amount: rows.reduce((n, r) => n + r[1], 0),
            count: rows.reduce((n, r) => n + r[2], 0),
            from,
            to,
          },
        },
        columns: [
          { key: 'method', type: 'text' },
          { key: 'amount', type: 'money' },
          { key: 'receipts', type: 'number' },
        ],
        rows,
      };
    },
  },
  {
    name: 'class_strength',
    describe:
      'How many students are in each class. E.g. "class strength", "how many students". No args.',
    roles: MONEY,
    async run(ctx) {
      const grouped = await ctx.prisma.student.groupBy({
        by: ['classId'],
        where: { tenantId: ctx.tenantId },
        _count: { _all: true },
      });
      const rows = grouped
        .map(
          (g) => [className(ctx, g.classId), g._count._all] as [string, number],
        )
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
      return {
        tool: 'class_strength',
        headline: {
          key: 'students_total',
          params: {
            count: rows.reduce((n, r) => n + r[1], 0),
            classes: rows.length,
          },
        },
        columns: [
          { key: 'class', type: 'text' },
          { key: 'students', type: 'number' },
        ],
        rows,
      };
    },
  },
  {
    name: 'teacher_workload',
    describe:
      'Weekly timetable periods per teacher. E.g. "teacher workload", "who has the most periods". No args.',
    roles: STAFF,
    async run(ctx) {
      const grouped = await ctx.prisma.timetableSlot.groupBy({
        by: ['teacherId'],
        where: { tenantId: ctx.tenantId },
        _count: { _all: true },
      });
      const teachers = await ctx.prisma.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          id: { in: grouped.map((g) => g.teacherId) },
        },
        select: { id: true, name: true },
      });
      const nameOf = new Map(teachers.map((t) => [t.id, t.name]));
      const rows = grouped
        .map(
          (g) =>
            [nameOf.get(g.teacherId) ?? '', g._count._all] as [string, number],
        )
        .sort((a, b) => b[1] - a[1]);
      return {
        tool: 'teacher_workload',
        headline: {
          key: 'teachers_with_periods',
          params: { count: rows.length },
        },
        columns: [
          { key: 'teacher', type: 'text' },
          { key: 'periods', type: 'number' },
        ],
        rows,
      };
    },
  },
];

// ── Parent tools (only the parent's own children — invariant #2) ────────────

export const PARENT_TOOLS: ToolDef[] = [
  {
    name: 'child_attendance',
    describe:
      "One child's attendance over a date range, with the days missed. Args: childId, from, to (default last 30 days).",
    roles: [Role.parent],
    async run(ctx, args) {
      const child = childOf(ctx, args.childId);
      if (!child) return pickChild(ctx);
      const { from, to } = range(ctx, args, 30);
      const records = await ctx.prisma.attendanceRecord.findMany({
        where: {
          tenantId: ctx.tenantId,
          studentId: child.id,
          date: { gte: toDbDate(from), lte: toDbDate(to) },
        },
        select: { date: true, status: true },
        orderBy: { date: 'desc' },
      });
      const ok = records.filter((r) => attended(r.status)).length;
      const missed = records.filter(
        (r) => !attended(r.status) || r.status === AttendanceStatus.late,
      );
      return {
        tool: 'child_attendance',
        headline: {
          key: 'child_attendance',
          params: {
            name: child.firstName,
            present: ok,
            marked: records.length,
            pct: pct(ok, records.length),
            from,
            to,
          },
        },
        columns: [
          { key: 'date', type: 'date' },
          { key: 'status', type: 'text' },
        ],
        ...cap(missed.map((r) => [ymd(r.date), r.status])),
      };
    },
  },
  {
    name: 'child_fees',
    describe: "One child's unpaid fees with due dates. Args: childId.",
    roles: [Role.parent],
    async run(ctx, args) {
      const child = childOf(ctx, args.childId);
      if (!child) return pickChild(ctx);
      const fees = await ctx.prisma.studentFee.findMany({
        where: {
          tenantId: ctx.tenantId,
          studentId: child.id,
          status: { in: UNPAID },
        },
        select: {
          amountDue: true,
          amountPaid: true,
          dueDate: true,
          feeStructure: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
      const rows = fees
        .map(
          (f) =>
            [
              f.feeStructure.name,
              Math.round(Number(f.amountDue.sub(f.amountPaid))),
              ymd(f.dueDate),
            ] as [string, number, string],
        )
        .filter((r) => r[1] > 0);
      return {
        tool: 'child_fees',
        headline: {
          key: 'child_fees',
          params: {
            name: child.firstName,
            amount: rows.reduce((n, r) => n + r[1], 0),
            count: rows.length,
          },
        },
        columns: [
          { key: 'fee', type: 'text' },
          { key: 'outstanding', type: 'money' },
          { key: 'dueDate', type: 'date' },
        ],
        rows,
      };
    },
  },
  {
    name: 'child_homework',
    describe:
      "Homework sent to one child's class recently. Args: childId, days (default 7).",
    roles: [Role.parent],
    async run(ctx, args) {
      const child = childOf(ctx, args.childId);
      if (!child) return pickChild(ctx);
      const days = num(args.days, 7, 1, 60);
      const items = await ctx.prisma.broadcast.findMany({
        where: {
          tenantId: ctx.tenantId,
          classId: child.classId,
          kind: 'homework',
          createdAt: {
            gte: new Date(
              Date.parse(`${ctx.today}T00:00:00Z`) - (days - 1) * DAY_MS,
            ),
          },
        },
        select: {
          createdAt: true,
          body: true,
          subject: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        tool: 'child_homework',
        headline: {
          key: 'child_homework',
          params: { name: child.firstName, count: items.length, days },
        },
        columns: [
          { key: 'date', type: 'date' },
          { key: 'subject', type: 'text' },
          { key: 'homework', type: 'text' },
        ],
        ...cap(
          items.map((i) => [ymd(i.createdAt), i.subject?.name ?? null, i.body]),
        ),
      };
    },
  },
  {
    name: 'recent_notices',
    describe:
      'Notices the school sent to this parent recently. Args: days (default 14).',
    roles: [Role.parent],
    async run(ctx, args) {
      const days = num(args.days, 14, 1, 90);
      const items = await ctx.prisma.notification.findMany({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          broadcastId: { not: null },
          broadcast: { kind: 'notice' },
          createdAt: {
            gte: new Date(
              Date.parse(`${ctx.today}T00:00:00Z`) - (days - 1) * DAY_MS,
            ),
          },
        },
        select: { createdAt: true, title: true, body: true },
        orderBy: { createdAt: 'desc' },
      });
      return {
        tool: 'recent_notices',
        headline: {
          key: 'recent_notices',
          params: { count: items.length, days },
        },
        columns: [
          { key: 'date', type: 'date' },
          { key: 'notice', type: 'text' },
        ],
        ...cap(
          items.map((i) => [
            ymd(i.createdAt),
            i.title ? `${i.title}: ${i.body}` : i.body,
          ]),
        ),
      };
    },
  },
];

/** A parent with several children didn't say which one. */
function pickChild(ctx: ToolContext): ToolResult {
  return {
    tool: 'pick_child',
    headline: {
      key: 'which_child',
      params: { names: ctx.children.map((c) => c.firstName).join(', ') },
    },
    columns: [],
    rows: [],
  };
}

export function toolsFor(role: Role): ToolDef[] {
  return [...STAFF_TOOLS, ...PARENT_TOOLS].filter((t) =>
    t.roles.includes(role),
  );
}
