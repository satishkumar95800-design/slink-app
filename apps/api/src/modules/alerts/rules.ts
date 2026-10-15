/**
 * Pattern warnings (docs/SPEC-ai.md phase 2) as pure functions over one
 * school's data snapshot, so each rule is easy to test and explain. Every
 * alert carries its reasons as i18n keys + params; clients render the text.
 *
 * Deliberately absent from every input: caste, gender, religion, health.
 */

export type Severity = 'info' | 'warning' | 'critical';
export type Audience = 'admin' | 'accounts' | 'teacher';

export interface Reason {
  key: string;
  params?: Record<string, string | number>;
}

export interface AlertDraft {
  kind: string;
  severity: Severity;
  subjectType: 'student' | 'class' | 'teacher' | 'fee' | 'school';
  subjectId?: string;
  subjectName?: string;
  reasons: Reason[];
  audience: Audience;
  teacherId?: string;
  dedupeKey: string;
}

export interface SchoolData {
  /** "YYYY-MM-DD" in the school's timezone. */
  today: string;
  /** Mon–Sat, not holidays, ascending, up to and including today (last ~9 weeks). */
  schoolDays: string[];
  students: {
    id: string;
    name: string;
    classId: string;
    parentIds: string[];
  }[];
  classes: {
    id: string;
    name: string;
    classTeacherIds: string[];
    studentCount: number;
  }[];
  attendance: {
    studentId: string;
    classId: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'leave';
  }[];
  notes: { studentId: string; type: string; date: string }[];
  /** Notice/homework pushes to parents, newest first. */
  parentNotices: { userId: string; date: string; seen: boolean }[];
  /** Unpaid fees (pending/partial/overdue). */
  fees: {
    id: string;
    studentId: string;
    dueDate: string;
    outstanding: number;
  }[];
  /** Past payments with the fee's due date, for "pays late" history. */
  payments: { studentId: string; dueDate: string; paidOn: string }[];
  /** Recent receipts recorded by staff. */
  receipts: {
    receiptNumber: string;
    reference: string | null;
    recordedBy: string | null;
    recordedByName: string | null;
    /** Hour 0–23, school time, when it was entered. */
    enteredHour: number;
    date: string;
  }[];
  concessions: {
    createdById: string;
    createdByName: string;
    amount: number;
    date: string;
  }[];
  teacherLoad: { teacherId: string; name: string; weeklyPeriods: number }[];
}

// ── Thresholds ───────────────────────────────────────────────────────────────
export const T = {
  streakWarning: 3,
  streakCritical: 5,
  weekdayMinAbsences: 4,
  weekdayMinSameDay: 3,
  weekdayShare: 0.5,
  dropWindowDays: 20,
  dropMinMarked: 8,
  dropPoints: 15,
  dropBelow: 85,
  lowAttendance: 80,
  siblingsMinDays: 2,
  notMarkedLookback: 5,
  notMarkedMin: 2,
  disengagedRecent: 5,
  complaintsWindowDays: 60,
  complaintsMin: 2,
  feeRiskWindowDays: 14,
  feeLateGraceDays: 3,
  feeLateMin: 2,
  oddHourStart: 22,
  oddHourEnd: 6,
  concessionWindowDays: 30,
  concessionMinCount: 5,
  concessionShare: 0.6,
  overloadMinPeriods: 30,
  overloadFactor: 1.4,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
/** 1 = Monday … 7 = Sunday. */
export function weekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const attended = (s: string) => s === 'present' || s === 'late';
export function normalizeRef(ref: string | null): string | null {
  const n = (ref ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return n.length >= 6 ? n : null;
}

/** Student-level alerts go to the class teacher (admins see everything). */
function teacherRoute(
  data: SchoolData,
  classId: string,
): Pick<AlertDraft, 'audience' | 'teacherId'> {
  const teacherId = data.classes.find((c) => c.id === classId)
    ?.classTeacherIds[0];
  return teacherId ? { audience: 'teacher', teacherId } : { audience: 'admin' };
}

function byStudent(data: SchoolData) {
  const map = new Map<string, SchoolData['attendance']>();
  for (const a of data.attendance)
    map.set(a.studentId, [...(map.get(a.studentId) ?? []), a]);
  return map;
}

// ── Attendance ───────────────────────────────────────────────────────────────

/** Consecutive absent days up to the latest marked school day. */
export function absenceStreak(
  records: SchoolData['attendance'],
  schoolDays: string[],
): number {
  const byDate = new Map(records.map((r) => [r.date, r.status]));
  let streak = 0;
  for (let i = schoolDays.length - 1; i >= 0; i--) {
    const status = byDate.get(schoolDays[i]);
    if (status === undefined) {
      if (streak === 0) continue; // today not marked yet
      continue; // class not marked that day: neither breaks nor extends
    }
    if (status !== 'absent') break;
    streak++;
  }
  return streak;
}

export function absenceStreaks(data: SchoolData): AlertDraft[] {
  const out: AlertDraft[] = [];
  const records = byStudent(data);
  for (const s of data.students) {
    const streak = absenceStreak(records.get(s.id) ?? [], data.schoolDays);
    if (streak < T.streakWarning) continue;
    out.push({
      kind: 'absence_streak',
      severity: streak >= T.streakCritical ? 'critical' : 'warning',
      subjectType: 'student',
      subjectId: s.id,
      subjectName: s.name,
      reasons: [{ key: 'absent_days_in_a_row', params: { days: streak } }],
      ...teacherRoute(data, s.classId),
      dedupeKey: `absence_streak:${s.id}`,
    });
  }
  return out;
}

export function weekdayAbsences(data: SchoolData): AlertDraft[] {
  const out: AlertDraft[] = [];
  for (const [studentId, records] of byStudent(data)) {
    const absences = records.filter((r) => r.status === 'absent');
    if (absences.length < T.weekdayMinAbsences) continue;
    const counts = new Map<number, number>();
    for (const a of absences)
      counts.set(weekday(a.date), (counts.get(weekday(a.date)) ?? 0) + 1);
    const [day, count] = [...counts].sort((x, y) => y[1] - x[1])[0];
    if (count < T.weekdayMinSameDay || count / absences.length < T.weekdayShare)
      continue;
    const s = data.students.find((x) => x.id === studentId);
    if (!s) continue;
    out.push({
      kind: 'weekday_absence',
      severity: 'info',
      subjectType: 'student',
      subjectId: s.id,
      subjectName: s.name,
      reasons: [
        {
          key: 'absent_on_weekday',
          params: { weekday: day, count, total: absences.length },
        },
      ],
      ...teacherRoute(data, s.classId),
      dedupeKey: `weekday_absence:${s.id}`,
    });
  }
  return out;
}

/** Attendance % over the last N school days and the N before that. */
export function attendanceWindows(
  records: SchoolData['attendance'],
  schoolDays: string[],
) {
  const n = T.dropWindowDays;
  const recent = new Set(schoolDays.slice(-n));
  const before = new Set(schoolDays.slice(-2 * n, -n));
  const sum = (days: Set<string>) => {
    const r = records.filter((x) => days.has(x.date));
    return {
      marked: r.length,
      pct: pct(r.filter((x) => attended(x.status)).length, r.length),
    };
  };
  return { recent: sum(recent), before: sum(before) };
}

export function attendanceDrops(data: SchoolData): AlertDraft[] {
  const out: AlertDraft[] = [];
  const records = byStudent(data);
  for (const s of data.students) {
    const { recent, before } = attendanceWindows(
      records.get(s.id) ?? [],
      data.schoolDays,
    );
    if (recent.marked < T.dropMinMarked || before.marked < T.dropMinMarked)
      continue;
    if (before.pct - recent.pct < T.dropPoints || recent.pct >= T.dropBelow)
      continue;
    out.push({
      kind: 'attendance_drop',
      severity: 'warning',
      subjectType: 'student',
      subjectId: s.id,
      subjectName: s.name,
      reasons: [
        {
          key: 'attendance_fell',
          params: { before: before.pct, now: recent.pct },
        },
      ],
      ...teacherRoute(data, s.classId),
      dedupeKey: `attendance_drop:${s.id}`,
    });
  }
  return out;
}

export function siblingsAbsent(data: SchoolData): AlertDraft[] {
  const families = new Map<string, Set<string>>();
  for (const s of data.students) {
    for (const p of s.parentIds)
      families.set(p, new Set([...(families.get(p) ?? []), s.id]));
  }
  const since = addDays(data.today, -30);
  const absentOn = new Map<string, Set<string>>(); // studentId -> dates
  for (const a of data.attendance) {
    if (a.status !== 'absent' || a.date < since) continue;
    absentOn.set(
      a.studentId,
      new Set([...(absentOn.get(a.studentId) ?? []), a.date]),
    );
  }
  const out: AlertDraft[] = [];
  const seen = new Set<string>();
  for (const kids of families.values()) {
    if (kids.size < 2) continue;
    const ids = [...kids].sort();
    const key = ids.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const dates = new Map<string, number>();
    for (const id of ids)
      for (const d of absentOn.get(id) ?? [])
        dates.set(d, (dates.get(d) ?? 0) + 1);
    const together = [...dates.values()].filter((n) => n >= 2).length;
    if (together < T.siblingsMinDays) continue;
    const names = ids
      .map((id) => data.students.find((s) => s.id === id)?.name ?? '')
      .filter(Boolean);
    out.push({
      kind: 'siblings_absent',
      severity: 'info',
      subjectType: 'student',
      subjectId: ids[0],
      subjectName: names.join(', '),
      reasons: [
        { key: 'siblings_absent_together', params: { days: together } },
      ],
      audience: 'admin',
      dedupeKey: `siblings_absent:${key}`,
    });
  }
  return out;
}

export function classesNotMarked(data: SchoolData): AlertDraft[] {
  // Today isn't over, so look at the school days before it.
  const days = data.schoolDays
    .filter((d) => d < data.today)
    .slice(-T.notMarkedLookback);
  const markedDays = new Map<string, Set<string>>();
  for (const a of data.attendance) {
    markedDays.set(
      a.classId,
      new Set([...(markedDays.get(a.classId) ?? []), a.date]),
    );
  }
  const out: AlertDraft[] = [];
  for (const c of data.classes) {
    if (c.studentCount === 0) continue;
    const missing = days.filter((d) => !markedDays.get(c.id)?.has(d));
    if (missing.length < T.notMarkedMin) continue;
    out.push({
      kind: 'class_not_marked',
      severity: missing.length >= 4 ? 'critical' : 'warning',
      subjectType: 'class',
      subjectId: c.id,
      subjectName: c.name,
      reasons: [
        {
          key: 'attendance_not_marked',
          params: { days: missing.length, of: days.length },
        },
      ],
      audience: 'admin',
      dedupeKey: `class_not_marked:${c.id}`,
    });
  }
  return out;
}

// ── Engagement & overall risk ────────────────────────────────────────────────

/** Parents whose last few notices all went unopened, though they used to open them. */
export function disengagedParents(data: SchoolData): Set<string> {
  const byParent = new Map<string, SchoolData['parentNotices']>();
  for (const n of data.parentNotices)
    byParent.set(n.userId, [...(byParent.get(n.userId) ?? []), n]);
  const out = new Set<string>();
  for (const [parentId, notices] of byParent) {
    const sorted = [...notices].sort((a, b) => (a.date < b.date ? 1 : -1));
    const recent = sorted.slice(0, T.disengagedRecent);
    const older = sorted.slice(T.disengagedRecent);
    if (
      recent.length === T.disengagedRecent &&
      recent.every((n) => !n.seen) &&
      older.some((n) => n.seen)
    ) {
      out.add(parentId);
    }
  }
  return out;
}

export function parentsDrifting(data: SchoolData): AlertDraft[] {
  const drifting = disengagedParents(data);
  const out: AlertDraft[] = [];
  for (const s of data.students) {
    if (!s.parentIds.some((p) => drifting.has(p))) continue;
    out.push({
      kind: 'parent_disengaged',
      severity: 'info',
      subjectType: 'student',
      subjectId: s.id,
      subjectName: s.name,
      reasons: [
        {
          key: 'parent_stopped_reading',
          params: { unread: T.disengagedRecent },
        },
      ],
      ...teacherRoute(data, s.classId),
      dedupeKey: `parent_disengaged:${s.id}`,
    });
  }
  return out;
}

/** Several signals together: the one alert worth a conversation. */
export function studentsAtRisk(data: SchoolData): AlertDraft[] {
  const records = byStudent(data);
  const drifting = disengagedParents(data);
  const complaintsSince = addDays(data.today, -T.complaintsWindowDays);
  const out: AlertDraft[] = [];
  for (const s of data.students) {
    const own = records.get(s.id) ?? [];
    const reasons: Reason[] = [];
    const { recent, before } = attendanceWindows(own, data.schoolDays);
    if (recent.marked >= T.dropMinMarked && recent.pct < T.lowAttendance) {
      reasons.push({ key: 'low_attendance', params: { pct: recent.pct } });
    }
    if (
      recent.marked >= T.dropMinMarked &&
      before.marked >= T.dropMinMarked &&
      before.pct - recent.pct >= T.dropPoints
    ) {
      reasons.push({
        key: 'attendance_fell',
        params: { before: before.pct, now: recent.pct },
      });
    }
    const streak = absenceStreak(own, data.schoolDays);
    if (streak >= T.streakWarning)
      reasons.push({ key: 'absent_days_in_a_row', params: { days: streak } });
    const complaints = data.notes.filter(
      (n) =>
        n.studentId === s.id &&
        n.type === 'complaint' &&
        n.date >= complaintsSince,
    ).length;
    if (complaints >= T.complaintsMin) {
      reasons.push({
        key: 'complaints',
        params: { count: complaints, days: T.complaintsWindowDays },
      });
    }
    if (s.parentIds.some((p) => drifting.has(p))) {
      reasons.push({
        key: 'parent_stopped_reading',
        params: { unread: T.disengagedRecent },
      });
    }
    if (reasons.length < 2) continue;
    out.push({
      kind: 'student_at_risk',
      severity: reasons.length >= 3 ? 'critical' : 'warning',
      subjectType: 'student',
      subjectId: s.id,
      subjectName: s.name,
      reasons,
      ...teacherRoute(data, s.classId),
      dedupeKey: `student_at_risk:${s.id}`,
    });
  }
  return out;
}

// ── Fees ─────────────────────────────────────────────────────────────────────

/** Families (all children of the same parents) who paid after the due date before. */
export function lateHistory(data: SchoolData): Map<string, number> {
  const familyOf = new Map<string, string>();
  for (const s of data.students)
    familyOf.set(s.id, [...s.parentIds].sort().join(',') || s.id);
  const late = new Map<string, number>();
  for (const p of data.payments) {
    if (daysBetween(p.dueDate, p.paidOn) <= T.feeLateGraceDays) continue;
    const fam = familyOf.get(p.studentId) ?? p.studentId;
    late.set(fam, (late.get(fam) ?? 0) + 1);
  }
  const byStudent = new Map<string, number>();
  for (const [studentId, fam] of familyOf)
    byStudent.set(studentId, late.get(fam) ?? 0);
  return byStudent;
}

export function feeLateRisk(data: SchoolData): AlertDraft[] {
  const late = lateHistory(data);
  const until = addDays(data.today, T.feeRiskWindowDays);
  const out: AlertDraft[] = [];
  for (const f of data.fees) {
    if (f.dueDate < data.today || f.dueDate > until || f.outstanding <= 0)
      continue;
    const reasons: Reason[] = [];
    const lateCount = late.get(f.studentId) ?? 0;
    const overdue = data.fees
      .filter(
        (o) =>
          o.studentId === f.studentId &&
          o.dueDate < data.today &&
          o.outstanding > 0,
      )
      .reduce((n, o) => n + o.outstanding, 0);
    // A pattern, not one slip: two late payments, or one plus something overdue now.
    // (Overdue alone is already on the accountant's defaulters report.)
    if (lateCount < T.feeLateMin && !(lateCount >= 1 && overdue > 0)) continue;
    reasons.push({ key: 'paid_late_before', params: { count: lateCount } });
    if (overdue > 0)
      reasons.push({
        key: 'has_overdue',
        params: { amount: Math.round(overdue) },
      });
    reasons.push({
      key: 'due_soon',
      params: { date: f.dueDate, amount: Math.round(f.outstanding) },
    });
    const s = data.students.find((x) => x.id === f.studentId);
    out.push({
      kind: 'fee_late_risk',
      severity: reasons.length >= 3 ? 'warning' : 'info',
      subjectType: 'fee',
      subjectId: f.id,
      subjectName: s?.name,
      reasons,
      audience: 'accounts',
      dedupeKey: `fee_late_risk:${f.id}`,
    });
  }
  return out;
}

/**
 * Expected collections for fees due in the next 30 days, each discounted by
 * how often that family paid late before (a simple, explainable estimate).
 */
export function expectedCollections(data: SchoolData): {
  due: number;
  expected: number;
} {
  const late = lateHistory(data);
  const paidCount = new Map<string, number>();
  for (const p of data.payments)
    paidCount.set(p.studentId, (paidCount.get(p.studentId) ?? 0) + 1);
  const until = addDays(data.today, 30);
  let due = 0;
  let expected = 0;
  for (const f of data.fees) {
    if (f.dueDate < data.today || f.dueDate > until) continue;
    const history = Math.max(
      paidCount.get(f.studentId) ?? 0,
      late.get(f.studentId) ?? 0,
    );
    const onTime =
      history > 0 ? 1 - (late.get(f.studentId) ?? 0) / history : 0.8;
    due += f.outstanding;
    expected += f.outstanding * Math.min(1, Math.max(0.2, onTime));
  }
  return { due: Math.round(due), expected: Math.round(expected) };
}

// ── Money anomalies ──────────────────────────────────────────────────────────

export function duplicateReferences(data: SchoolData): AlertDraft[] {
  const byRef = new Map<string, string[]>();
  for (const r of data.receipts) {
    const ref = normalizeRef(r.reference);
    if (ref) byRef.set(ref, [...(byRef.get(ref) ?? []), r.receiptNumber]);
  }
  return [...byRef]
    .filter(([, numbers]) => numbers.length > 1)
    .map(([ref, numbers]) => ({
      kind: 'duplicate_reference',
      severity: 'warning' as const,
      subjectType: 'school' as const,
      subjectName: ref,
      reasons: [
        {
          key: 'reference_on_receipts',
          params: { ref, receipts: numbers.join(', ') },
        },
      ],
      audience: 'accounts' as const,
      dedupeKey: `duplicate_reference:${ref}`,
    }));
}

export function oddHourReceipts(data: SchoolData): AlertDraft[] {
  const since = addDays(data.today, -7);
  const byStaff = new Map<string, { name: string; count: number }>();
  for (const r of data.receipts) {
    if (!r.recordedBy || r.date < since) continue;
    if (r.enteredHour < T.oddHourStart && r.enteredHour >= T.oddHourEnd)
      continue;
    const cur = byStaff.get(r.recordedBy) ?? {
      name: r.recordedByName ?? '',
      count: 0,
    };
    byStaff.set(r.recordedBy, { ...cur, count: cur.count + 1 });
  }
  return [...byStaff].map(([staffId, { name, count }]) => ({
    kind: 'odd_hour_receipts',
    severity: 'info' as const,
    subjectType: 'teacher' as const,
    subjectId: staffId,
    subjectName: name,
    reasons: [{ key: 'receipts_late_at_night', params: { count } }],
    audience: 'admin' as const,
    dedupeKey: `odd_hour_receipts:${staffId}`,
  }));
}

export function concessionConcentration(data: SchoolData): AlertDraft[] {
  const since = addDays(data.today, -T.concessionWindowDays);
  const recent = data.concessions.filter((c) => c.date >= since);
  if (recent.length === 0) return [];
  const byStaff = new Map<
    string,
    { name: string; count: number; amount: number }
  >();
  for (const c of recent) {
    const cur = byStaff.get(c.createdById) ?? {
      name: c.createdByName,
      count: 0,
      amount: 0,
    };
    byStaff.set(c.createdById, {
      name: cur.name,
      count: cur.count + 1,
      amount: cur.amount + c.amount,
    });
  }
  return [...byStaff]
    .filter(
      ([, s]) =>
        s.count >= T.concessionMinCount &&
        s.count / recent.length >= T.concessionShare,
    )
    .map(([staffId, s]) => ({
      kind: 'concession_concentration',
      severity: 'warning' as const,
      subjectType: 'teacher' as const,
      subjectId: staffId,
      subjectName: s.name,
      reasons: [
        {
          key: 'concessions_by_one_person',
          params: {
            count: s.count,
            total: recent.length,
            amount: Math.round(s.amount),
            days: T.concessionWindowDays,
          },
        },
      ],
      audience: 'admin' as const,
      dedupeKey: `concession_concentration:${staffId}`,
    }));
}

// ── Teachers ─────────────────────────────────────────────────────────────────

export function teacherOverload(data: SchoolData): AlertDraft[] {
  const loads = data.teacherLoad.filter((t) => t.weeklyPeriods > 0);
  if (loads.length < 2) return [];
  const avg = loads.reduce((n, t) => n + t.weeklyPeriods, 0) / loads.length;
  const limit = Math.max(T.overloadMinPeriods, avg * T.overloadFactor);
  return loads
    .filter((t) => t.weeklyPeriods > limit)
    .map((t) => ({
      kind: 'teacher_overload',
      severity: 'info' as const,
      subjectType: 'teacher' as const,
      subjectId: t.teacherId,
      subjectName: t.name,
      reasons: [
        {
          key: 'periods_vs_average',
          params: { periods: t.weeklyPeriods, average: Math.round(avg) },
        },
      ],
      audience: 'admin' as const,
      dedupeKey: `teacher_overload:${t.teacherId}`,
    }));
}

export const ALL_RULES = [
  absenceStreaks,
  weekdayAbsences,
  attendanceDrops,
  siblingsAbsent,
  classesNotMarked,
  parentsDrifting,
  studentsAtRisk,
  feeLateRisk,
  duplicateReferences,
  oddHourReceipts,
  concessionConcentration,
  teacherOverload,
];

export function runRules(data: SchoolData): AlertDraft[] {
  return ALL_RULES.flatMap((rule) => rule(data));
}
