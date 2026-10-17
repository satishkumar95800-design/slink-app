import { AdmissionStage } from '@prisma/client';

/** Pipeline order; `lost` is outside it (docs/SPEC-franchise.md §4). */
export const PIPELINE: AdmissionStage[] = [
  'enquiry',
  'campus_tour',
  'follow_up',
  'registration',
  'enrolled',
];

const rank = (s: AdmissionStage) => PIPELINE.indexOf(s);

/** The furthest pipeline stage an enquiry ever reached (from its current stage and history). */
export function furthestStage(
  current: AdmissionStage,
  history: (AdmissionStage | null)[],
): AdmissionStage {
  let best = 0;
  for (const s of [current, ...history]) {
    if (s && s !== 'lost') best = Math.max(best, rank(s));
  }
  return PIPELINE[best];
}

export interface Funnel {
  enquiries: number;
  /** Reached a campus tour or further. */
  tours: number;
  /** Reached registration or further. */
  registrations: number;
  enrolled: number;
  lost: number;
  open: number;
  /** Enrolled out of all enquiries, one decimal; null with none. */
  conversionPct: number | null;
}

export function funnelOf(
  rows: { stage: AdmissionStage; furthest: AdmissionStage }[],
): Funnel {
  const reached = (s: AdmissionStage) =>
    rows.filter((r) => rank(r.furthest) >= rank(s)).length;
  const enrolled = rows.filter((r) => r.stage === 'enrolled').length;
  const lost = rows.filter((r) => r.stage === 'lost').length;
  return {
    enquiries: rows.length,
    tours: reached('campus_tour'),
    registrations: reached('registration'),
    enrolled,
    lost,
    open: rows.length - enrolled - lost,
    conversionPct:
      rows.length === 0
        ? null
        : Math.round((enrolled / rows.length) * 1000) / 10,
  };
}

/** Admissions run by academic year, from 1 June. */
export function academicYearStart(today: string): string {
  const year = Number(today.slice(0, 4));
  const start = `${year}-06-01`;
  return today >= start ? start : `${year - 1}-06-01`;
}
