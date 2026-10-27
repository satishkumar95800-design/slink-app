import {
  branchScore,
  BranchFacts,
  findingText,
  groupFindings,
} from './group-insights';
import { plainBrief, weekStartOf } from './group-insights.service';
import type { BranchMetrics } from './head-office.service';
import type { Funnel } from '../admissions/admissions.math';

const funnel = (enquiries: number, enrolled: number): Funnel => ({
  enquiries,
  tours: enrolled,
  registrations: enrolled,
  enrolled,
  lost: 0,
  open: enquiries - enrolled,
  conversionPct: Math.round((enrolled / enquiries) * 1000) / 10,
});

const metrics = (over: Partial<BranchMetrics> = {}): BranchMetrics => ({
  students: 300,
  staff: 20,
  attendanceToday: { pct: 95, marked: 280 },
  attendance30: 94,
  fees: {
    academicYear: '2026-27',
    collected: 900000,
    outstanding: 100000,
    collectionPct: 90,
    overdueCount: 0,
  },
  noticesLast30: 10,
  appUsePct: 85,
  syllabus: null,
  compliance: { state: 'done', classes: 10, notMarked: 0 },
  admissions: null,
  ...over,
});
const branch = (
  name: string,
  over: Partial<BranchFacts> = {},
  m: Partial<BranchMetrics> = {},
): BranchFacts => ({
  id: name,
  name,
  metrics: metrics(m),
  attendancePrev30: 94,
  collectedLast30: 100000,
  collectedPrev30: 100000,
  ...over,
});

describe('head office insights', () => {
  it('scores a healthy branch high and a struggling one low', () => {
    expect(branchScore(branch('A')).band).toBe('good');
    const weak = branchScore(
      branch(
        'B',
        {},
        {
          attendance30: 72,
          appUsePct: 25,
          fees: {
            academicYear: '2026-27',
            collected: 500000,
            outstanding: 500000,
            collectionPct: 50,
            overdueCount: 40,
          },
          compliance: { state: 'late', classes: 10, notMarked: 4 },
        },
      ),
    );
    expect(weak.score).toBeLessThan(20);
    expect(weak.band).toBe('risk');
  });

  it('has no score with only today’s attendance to go on', () => {
    expect(
      branchScore(
        branch(
          'New',
          {},
          {
            attendance30: null,
            students: 0,
            fees: {
              academicYear: null,
              collected: 0,
              outstanding: 0,
              collectionPct: null,
              overdueCount: 0,
            },
          },
        ),
      ).score,
    ).toBeNull();
  });

  it('finds drops, lagging fees, slowing collections, weak admissions and late attendance', () => {
    const findings = groupFindings([
      branch('Good'),
      branch('Drop', { attendancePrev30: 93 }, { attendance30: 80.5 }),
      branch(
        'Fees',
        { collectedLast30: 40000, collectedPrev30: 100000 },
        {
          fees: {
            academicYear: '2026-27',
            collected: 600000,
            outstanding: 400000,
            collectionPct: 60,
            overdueCount: 25,
          },
        },
      ),
      branch(
        'Late',
        {},
        {
          compliance: { state: 'late', classes: 10, notMarked: 3 },
          admissions: funnel(20, 1),
        },
      ),
      branch(
        'Conv',
        {},
        {
          admissions: funnel(10, 6),
        },
      ),
    ]);
    const kinds = findings.map(
      (f) => `${f.kind}:${f.branch ?? '-'}:${f.severity}`,
    );
    expect(kinds).toEqual(
      expect.arrayContaining([
        'attendance_late_today:Late:risk',
        'attendance_drop:Drop:risk',
        'collection_behind:Fees:risk',
        'collections_slowing:Fees:watch',
        'admissions_weak:Late:watch',
        'group_dues:-:watch',
      ]),
    );
    // Risks come first, the good news last.
    expect(findings[0].severity).toBe('risk');
    expect(findings.at(-1)!.kind).toBe('top_branch');
  });

  it('writes each finding as a sentence with its numbers', () => {
    const [f] = groupFindings([
      branch('Drop', { attendancePrev30: 93 }, { attendance30: 80.5 }),
    ]);
    expect(findingText(f)).toBe(
      'Drop: attendance fell to 80.5% over the last 30 days, from 93% the month before.',
    );
    expect(plainBrief([f])).toMatch(/^- Drop: /);
  });

  it('weeks start on Monday', () => {
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26'); // Monday
    expect(weekStartOf('2026-11-01')).toBe('2026-10-26'); // Sunday
    expect(weekStartOf('2026-10-28')).toBe('2026-10-26');
  });
});
