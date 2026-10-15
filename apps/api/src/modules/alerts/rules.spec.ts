import {
  SchoolData,
  absenceStreak,
  absenceStreaks,
  addDays,
  attendanceDrops,
  classesNotMarked,
  concessionConcentration,
  duplicateReferences,
  expectedCollections,
  feeLateRisk,
  oddHourReceipts,
  parentsDrifting,
  runRules,
  siblingsAbsent,
  studentsAtRisk,
  teacherOverload,
  weekday,
  weekdayAbsences,
} from './rules';

const TODAY = '2026-10-16'; // Friday

/** Mon–Sat school days for the last ~9 weeks up to TODAY. */
function schoolDays(): string[] {
  const days: string[] = [];
  for (let d = addDays(TODAY, -63); d <= TODAY; d = addDays(d, 1)) {
    if (weekday(d) !== 7) days.push(d);
  }
  return days;
}

function school(over: Partial<SchoolData> = {}): SchoolData {
  return {
    today: TODAY,
    schoolDays: schoolDays(),
    students: [
      { id: 's1', name: 'Aarav', classId: 'c1', parentIds: ['p1'] },
      { id: 's2', name: 'Diya', classId: 'c2', parentIds: ['p1'] },
      { id: 's3', name: 'Kabir', classId: 'c1', parentIds: ['p2'] },
    ],
    classes: [
      { id: 'c1', name: 'Class 5 A', classTeacherIds: ['t1'], studentCount: 2 },
      { id: 'c2', name: 'Class 3 A', classTeacherIds: [], studentCount: 1 },
    ],
    attendance: [],
    notes: [],
    parentNotices: [],
    fees: [],
    payments: [],
    receipts: [],
    concessions: [],
    teacherLoad: [],
    ...over,
  };
}

/** Everyone present on every school day, then apply overrides. */
function presentEverywhere(
  overrides: Record<
    string,
    Record<string, SchoolData['attendance'][0]['status']>
  > = {},
) {
  const data = school();
  return data.schoolDays
    .filter((d) => d <= TODAY)
    .flatMap((date) =>
      data.students.map((s) => ({
        studentId: s.id,
        classId: s.classId,
        date,
        status: overrides[s.id]?.[date] ?? 'present',
      })),
    );
}

describe('attendance rules', () => {
  const days = schoolDays();
  const last = (n: number) => days.slice(-n);

  it('counts an absence streak, skipping days the class was not marked', () => {
    const records = [
      {
        studentId: 's1',
        classId: 'c1',
        date: days[days.length - 4],
        status: 'present' as const,
      },
      {
        studentId: 's1',
        classId: 'c1',
        date: days[days.length - 3],
        status: 'absent' as const,
      },
      // days.length - 2 not marked
      {
        studentId: 's1',
        classId: 'c1',
        date: days[days.length - 1],
        status: 'absent' as const,
      },
    ];
    expect(absenceStreak(records, days)).toBe(2);
  });

  it('warns at 3 days absent in a row and is critical at 5, routed to the class teacher', () => {
    const three = Object.fromEntries(
      last(3).map((d) => [d, 'absent' as const]),
    );
    const five = Object.fromEntries(last(5).map((d) => [d, 'absent' as const]));
    const alerts = absenceStreaks(
      school({ attendance: presentEverywhere({ s1: three, s2: five }) }),
    );
    const s1 = alerts.find((a) => a.subjectId === 's1');
    const s2 = alerts.find((a) => a.subjectId === 's2');
    expect(s1).toMatchObject({
      severity: 'warning',
      audience: 'teacher',
      teacherId: 't1',
    });
    expect(s2).toMatchObject({ severity: 'critical', audience: 'admin' }); // class has no class teacher
    expect(alerts.find((a) => a.subjectId === 's3')).toBeUndefined();
  });

  it('spots absences that fall on the same weekday', () => {
    const mondays = days.filter((d) => weekday(d) === 1).slice(-4);
    const absent = Object.fromEntries(
      mondays.map((d) => [d, 'absent' as const]),
    );
    const [alert] = weekdayAbsences(
      school({ attendance: presentEverywhere({ s3: absent }) }),
    );
    expect(alert).toMatchObject({ kind: 'weekday_absence', subjectId: 's3' });
    expect(alert.reasons[0]).toEqual({
      key: 'absent_on_weekday',
      params: { weekday: 1, count: 4, total: 4 },
    });
  });

  it('flags a real drop in attendance but not a small one', () => {
    const recent = last(20);
    const absentHalf = Object.fromEntries(
      recent.filter((_, i) => i % 2 === 0).map((d) => [d, 'absent' as const]),
    );
    const absentOne = { [recent[0]]: 'absent' as const };
    const alerts = attendanceDrops(
      school({
        attendance: presentEverywhere({ s1: absentHalf, s3: absentOne }),
      }),
    );
    expect(alerts.map((a) => a.subjectId)).toEqual(['s1']);
    expect(alerts[0].reasons[0]).toEqual({
      key: 'attendance_fell',
      params: { before: 100, now: 50 },
    });
  });

  it('notices siblings absent together', () => {
    const both = Object.fromEntries(
      last(6)
        .slice(0, 2)
        .map((d) => [d, 'absent' as const]),
    );
    const [alert] = siblingsAbsent(
      school({ attendance: presentEverywhere({ s1: both, s2: both }) }),
    );
    expect(alert).toMatchObject({
      kind: 'siblings_absent',
      subjectName: 'Aarav, Diya',
      audience: 'admin',
    });
  });

  it('flags a class that has not been marked on recent school days', () => {
    const attendance = presentEverywhere().filter(
      (a) => !(a.classId === 'c2' && last(4).slice(0, 3).includes(a.date)),
    );
    const alerts = classesNotMarked(school({ attendance }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ subjectId: 'c2', severity: 'warning' });
  });
});

describe('engagement and risk', () => {
  const notices = (userId: string, seen: boolean[]) =>
    seen.map((s, i) => ({
      userId,
      date: `2026-10-${String(15 - i).padStart(2, '0')}T08:00:00Z`,
      seen: s,
    }));

  it('flags parents who stopped opening notices, not ones who never did', () => {
    const data = school({
      parentNotices: [
        ...notices('p1', [false, false, false, false, false, true, true]),
        ...notices('p2', [false, false, false, false, false, false]),
      ],
    });
    expect(
      parentsDrifting(data)
        .map((a) => a.subjectId)
        .sort(),
    ).toEqual(['s1', 's2']);
  });

  it('raises "at risk" only when two or more signals line up', () => {
    const recent = schoolDays().slice(-20);
    const lowAttendance = Object.fromEntries(
      recent.slice(0, 8).map((d) => [d, 'absent' as const]),
    );
    const data = school({
      attendance: presentEverywhere({
        s1: lowAttendance,
        s3: { [recent[0]]: 'absent' },
      }),
      notes: [
        { studentId: 's1', type: 'complaint', date: '2026-10-01' },
        { studentId: 's1', type: 'complaint', date: '2026-10-08' },
        { studentId: 's3', type: 'complaint', date: '2026-10-08' },
      ],
    });
    const alerts = studentsAtRisk(data);
    expect(alerts.map((a) => a.subjectId)).toEqual(['s1']);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].reasons.map((r) => r.key)).toEqual([
      'low_attendance',
      'attendance_fell',
      'complaints',
    ]);
  });
});

describe('fee rules', () => {
  it('warns accounts about a fee due soon for a family that paid late before', () => {
    const data = school({
      fees: [
        { id: 'f1', studentId: 's1', dueDate: '2026-10-25', outstanding: 5000 },
      ],
      payments: [
        { studentId: 's2', dueDate: '2026-06-10', paidOn: '2026-07-02' }, // sibling, late
        { studentId: 's1', dueDate: '2026-08-10', paidOn: '2026-08-30' }, // late
        { studentId: 's3', dueDate: '2026-08-10', paidOn: '2026-08-30' }, // other family
      ],
    });
    const [alert] = feeLateRisk(data);
    expect(alert).toMatchObject({
      kind: 'fee_late_risk',
      subjectId: 'f1',
      audience: 'accounts',
    });
    expect(alert.reasons[0]).toEqual({
      key: 'paid_late_before',
      params: { count: 2 },
    });
  });

  it('expects less from families that usually pay late', () => {
    const data = school({
      fees: [
        { id: 'f1', studentId: 's1', dueDate: '2026-10-20', outstanding: 1000 },
        { id: 'f2', studentId: 's3', dueDate: '2026-10-20', outstanding: 1000 },
      ],
      payments: [
        { studentId: 's1', dueDate: '2026-06-10', paidOn: '2026-07-10' },
        { studentId: 's3', dueDate: '2026-06-10', paidOn: '2026-06-09' },
      ],
    });
    expect(expectedCollections(data)).toEqual({ due: 2000, expected: 1200 });
  });
});

describe('money anomalies', () => {
  const receipt = (over: Partial<SchoolData['receipts'][0]>) => ({
    receiptNumber: 'R-1',
    reference: null,
    recordedBy: 'acc1',
    recordedByName: 'Priya',
    enteredHour: 11,
    date: '2026-10-15',
    ...over,
  });

  it('flags the same reference on two receipts, whatever its spacing', () => {
    const [alert] = duplicateReferences(
      school({
        receipts: [
          receipt({ receiptNumber: 'R-1', reference: 'UTR 1234 5678' }),
          receipt({ receiptNumber: 'R-7', reference: 'utr12345678' }),
          receipt({ receiptNumber: 'R-9', reference: 'other-999999' }),
        ],
      }),
    );
    expect(alert.reasons[0].params).toEqual({
      ref: 'UTR12345678',
      receipts: 'R-1, R-7',
    });
  });

  it('flags receipts entered late at night, per staff member', () => {
    const alerts = oddHourReceipts(
      school({
        receipts: [
          receipt({ enteredHour: 23 }),
          receipt({ enteredHour: 2 }),
          receipt({ enteredHour: 14 }),
        ],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].reasons[0].params).toEqual({ count: 2 });
  });

  it('flags most concessions coming from one person', () => {
    const c = (by: string) => ({
      createdById: by,
      createdByName: by,
      amount: 1000,
      date: '2026-10-10',
    });
    const alerts = concessionConcentration(
      school({ concessions: [c('a'), c('a'), c('a'), c('a'), c('a'), c('b')] }),
    );
    expect(alerts.map((a) => a.subjectId)).toEqual(['a']);
  });
});

describe('teachers and the whole run', () => {
  it('flags a teacher far above the school average', () => {
    const alerts = teacherOverload(
      school({
        teacherLoad: [
          { teacherId: 't1', name: 'A', weeklyPeriods: 40 },
          { teacherId: 't2', name: 'B', weeklyPeriods: 20 },
          { teacherId: 't3', name: 'C', weeklyPeriods: 18 },
        ],
      }),
    );
    expect(alerts.map((a) => a.subjectId)).toEqual(['t1']);
  });

  it('produces nothing for a quiet, healthy school', () => {
    expect(runRules(school({ attendance: presentEverywhere() }))).toEqual([]);
  });

  it('gives every alert a stable dedupe key', () => {
    const data = school({
      attendance: presentEverywhere({
        s1: Object.fromEntries(
          schoolDays()
            .slice(-5)
            .map((d) => [d, 'absent' as const]),
        ),
      }),
    });
    const keys = runRules(data).map((a) => a.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(runRules(data).map((a) => a.dedupeKey)).toEqual(keys);
  });
});
