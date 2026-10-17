import { progressOf } from './syllabus.math';

const t = (plannedBy: string, completedOn: string | null = null) => ({
  plannedBy,
  completedOn,
});

describe('syllabus progress', () => {
  it('is not planned without topics', () => {
    expect(progressOf([], '2026-10-17')).toMatchObject({
      status: 'not_planned',
      total: 0,
      percent: 0,
      nextIndex: -1,
    });
  });

  it('is on time when nothing is past its date (due today still counts as on time)', () => {
    const p = progressOf(
      [t('2026-10-01', '2026-09-30'), t('2026-10-17'), t('2026-11-01')],
      '2026-10-17',
    );
    expect(p).toMatchObject({
      status: 'on_time',
      covered: 1,
      percent: 33,
      expectedByToday: 2,
      expectedPercent: 67,
      overdue: 0,
      daysLate: 0,
      nextIndex: 1,
    });
  });

  it('is late from the oldest uncovered target date', () => {
    const p = progressOf(
      [t('2026-10-05'), t('2026-10-10'), t('2026-10-20')],
      '2026-10-17',
    );
    expect(p).toMatchObject({ status: 'late', overdue: 2, daysLate: 12 });
  });

  it('a topic due yesterday is one day late', () => {
    expect(progressOf([t('2026-10-16')], '2026-10-17').daysLate).toBe(1);
  });

  it('is completed when every topic is covered, even if covered late', () => {
    const p = progressOf(
      [t('2026-09-01', '2026-09-20'), t('2026-09-15', '2026-09-25')],
      '2026-10-17',
    );
    expect(p).toMatchObject({ status: 'completed', percent: 100, overdue: 0 });
  });
});
