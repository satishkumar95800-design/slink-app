export type SyllabusStatus = 'not_planned' | 'on_time' | 'late' | 'completed';

/** Derived by the API (syllabus.math.ts); dates are YYYY-MM-DD. */
export interface Progress {
  total: number;
  covered: number;
  percent: number;
  expectedByToday: number;
  expectedPercent: number;
  overdue: number;
  status: SyllabusStatus;
  daysLate: number;
  nextIndex: number;
}

export interface Person {
  id: string;
  name: string;
}

/** One class and subject (GET /syllabus/overview). */
export interface OverviewRow extends Progress {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teachers: Person[];
  nextTopic: { title: string; plannedBy: string } | null;
}

export interface PlanTopic {
  id: string;
  unit: string | null;
  title: string;
  plannedBy: string;
  completedOn: string | null;
  completedBy: Person | null;
  overdue: boolean;
}

/** GET /syllabus/:classId/:subjectId */
export interface Plan extends Progress {
  class: Person;
  subject: Person;
  teachers: Person[];
  canEdit: boolean;
  canMark: boolean;
  topics: PlanTopic[];
}

export interface ImportReport {
  rows: number;
  errors: { row: number; code: string; value?: string }[];
  plans: { className: string; subjectName: string; topics: number; existingTopics: number; existingCovered: number }[];
}

export const IMPORT_ERROR_CODES = [
  'FILE_UNREADABLE',
  'HEADERS_MISSING',
  'TOO_MANY_ROWS',
  'CLASS_MISSING',
  'SUBJECT_MISSING',
  'TOPIC_MISSING',
  'TOPIC_TOO_LONG',
  'DATE_INVALID',
  'CLASS_UNKNOWN',
  'SUBJECT_UNKNOWN',
] as const;

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
