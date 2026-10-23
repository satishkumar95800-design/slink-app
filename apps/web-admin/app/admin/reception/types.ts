import type { Stage } from '../admissions/types';

export const FOLLOW_UP_KINDS = ['call', 'visit', 'whatsapp', 'email', 'other'] as const;
export const PAYMENT_MODES = ['cash', 'upi', 'card', 'cheque', 'bank_transfer'] as const;
export const PAYMENT_PURPOSES = ['registration_fee', 'application_form', 'other'] as const;
export const DOCUMENT_KINDS = [
  'birth_certificate',
  'transfer_certificate',
  'report_card',
  'photos',
  'child_aadhaar',
  'parent_id_proof',
  'address_proof',
  'medical_certificate',
] as const;
export const VISITOR_PURPOSES = ['admission_enquiry', 'parent_meeting', 'interview', 'vendor', 'delivery', 'official', 'other'] as const;

/** Today in the browser's calendar (the school's day for a desk in the school). */
export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface EnquiryRef {
  id: string;
  childName: string;
  parentName: string;
  phone: string;
  stage: Stage;
  classSought: string | null;
}

export interface FollowUp {
  id: string;
  dueOn: string;
  kind: (typeof FOLLOW_UP_KINDS)[number];
  note: string | null;
  done: boolean;
  doneAt: string | null;
  doneBy?: string | null;
  outcome: string | null;
  overdue: boolean;
  enquiry: EnquiryRef;
}

export interface DeskPayment {
  id: string;
  receiptNo: number;
  purpose: (typeof PAYMENT_PURPOSES)[number];
  amount: string;
  mode: (typeof PAYMENT_MODES)[number];
  reference: string | null;
  receivedOn: string;
  receivedBy: string;
  void: { at: string; by: string; reason: string | null } | null;
  createdAt: string;
}

export interface Call {
  id: string;
  direction: 'incoming' | 'outgoing';
  name: string | null;
  phone: string;
  enquiryId: string | null;
  purpose: string | null;
  note: string | null;
  at: string;
  enquiry?: { id: string; childName: string } | null;
}

export interface Visitor {
  id: string;
  name: string;
  phone: string | null;
  purpose: (typeof VISITOR_PURPOSES)[number];
  whomToMeet: string | null;
  people: number;
  note: string | null;
  inAt: string;
  outAt: string | null;
}

export interface DeskData {
  followUps: FollowUp[];
  documents: { kind: (typeof DOCUMENT_KINDS)[number]; received: boolean; receivedAt: string | null; receivedBy: string | null; note: string | null }[];
  payments: DeskPayment[];
  calls: Call[];
}

export interface Today {
  date: string;
  followUps: FollowUp[];
  visitorsInside: Visitor[];
  counts: {
    visitorsToday: number;
    callsToday: number;
    newEnquiriesToday: number;
    registrationsWithoutFee: number;
    byStage: Partial<Record<Stage, number>>;
  };
}

export interface Receipt extends DeskPayment {
  enquiry: { childName: string; parentName: string; phone: string; classSought: string | null };
  school: { name: string; address: string | null; phone: string | null };
}
