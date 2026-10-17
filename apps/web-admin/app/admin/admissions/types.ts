export type Stage = 'enquiry' | 'campus_tour' | 'follow_up' | 'registration' | 'enrolled' | 'lost';
export type Source = 'walk_in' | 'phone' | 'website' | 'referral' | 'social_media' | 'other';

export const STAGES: Stage[] = ['enquiry', 'campus_tour', 'follow_up', 'registration', 'enrolled', 'lost'];
export const SOURCES: Source[] = ['walk_in', 'phone', 'website', 'referral', 'social_media', 'other'];

export const STAGE_VARIANT = {
  enquiry: 'blue',
  campus_tour: 'purple',
  follow_up: 'yellow',
  registration: 'orange',
  enrolled: 'green',
  lost: 'gray',
} as const satisfies Record<Stage, string>;

export interface Funnel {
  enquiries: number;
  tours: number;
  registrations: number;
  enrolled: number;
  lost: number;
  open: number;
  conversionPct: number | null;
}

export interface Summary {
  today: string;
  academicYearFrom: string;
  funnel: Funnel;
  stages: Partial<Record<Stage, number>>;
  followUps: { today: number; overdue: number };
  bySource: Partial<Record<Source, number>>;
}

export interface Enquiry {
  id: string;
  childName: string;
  dob: string | null;
  classSought: string | null;
  parentName: string;
  phone: string;
  email: string | null;
  source: Source;
  stage: Stage;
  tourOn: string | null;
  nextFollowUpOn: string | null;
  followUpDue: boolean;
  lostReason: string | null;
  notes: string | null;
  assignedTo: { id: string; name: string } | null;
  stageChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnquiryDetail extends Enquiry {
  activities: { id: string; kind: string; fromStage: Stage | null; toStage: Stage | null; note: string | null; by: string; createdAt: string }[];
}
