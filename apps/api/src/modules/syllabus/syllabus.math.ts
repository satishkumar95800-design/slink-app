import { daysBetween } from '../attendance/attendance-dates';

/**
 * On time / late for one class's subject plan, derived from the topic dates
 * (never stored). Dates are YYYY-MM-DD in the school's timezone.
 *
 *   overdue   = not covered and its target date is before today
 *   late      = at least one overdue topic; daysLate counts from the oldest
 *   on time   = nothing overdue (topics due today are still on time)
 */

export type SyllabusStatus = 'not_planned' | 'on_time' | 'late' | 'completed';

export interface TopicDates {
  plannedBy: string;
  completedOn: string | null;
}

export interface Progress {
  total: number;
  covered: number;
  percent: number;
  /** Topics whose target date is today or earlier. */
  expectedByToday: number;
  expectedPercent: number;
  overdue: number;
  status: SyllabusStatus;
  daysLate: number;
  /** Index (in teaching order) of the first topic not yet covered, or -1. */
  nextIndex: number;
}

const pct = (n: number, total: number) =>
  total === 0 ? 0 : Math.round((n / total) * 100);

export function isOverdue(t: TopicDates, today: string): boolean {
  return !t.completedOn && t.plannedBy < today;
}

/** `topics` in teaching order. */
export function progressOf(topics: TopicDates[], today: string): Progress {
  const total = topics.length;
  const covered = topics.filter((t) => t.completedOn).length;
  const expectedByToday = topics.filter((t) => t.plannedBy <= today).length;
  const overdueTopics = topics.filter((t) => isOverdue(t, today));
  const oldest = overdueTopics.reduce<string | null>(
    (min, t) => (min === null || t.plannedBy < min ? t.plannedBy : min),
    null,
  );
  const status: SyllabusStatus =
    total === 0
      ? 'not_planned'
      : covered === total
        ? 'completed'
        : overdueTopics.length > 0
          ? 'late'
          : 'on_time';
  return {
    total,
    covered,
    percent: pct(covered, total),
    expectedByToday,
    expectedPercent: pct(expectedByToday, total),
    overdue: overdueTopics.length,
    status,
    // daysBetween counts both ends; a topic due yesterday is 1 day late.
    daysLate: oldest ? daysBetween(oldest, today) - 1 : 0,
    nextIndex: topics.findIndex((t) => !t.completedOn),
  };
}
