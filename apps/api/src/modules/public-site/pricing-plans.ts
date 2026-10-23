/**
 * Plans and prices for the marketing-site price list (PDF). Kept in the API so
 * prices reach a visitor only after they leave their details. The modules each
 * plan switches on are the presets in the platform tenant page (PLANS).
 */
export const PRICING_YEAR = '2026-27';
export const PRICING_FILENAME = `Schoolinkd_Plans_and_Pricing_${PRICING_YEAR}.pdf`;

export interface Plan {
  name: string;
  tagline: string;
  /** Yearly price in rupees, before GST. */
  price: number;
  students: number;
  extraStudent: number;
  highlights: string[];
}

export const GST_RATE = 0.18;

export const PLANS: Plan[] = [
  {
    name: 'Basic',
    tagline: 'For small schools moving off paper and WhatsApp',
    price: 13333,
    students: 400,
    extraStudent: 40,
    highlights: [
      'Parent and teacher mobile app (Android and iPhone)',
      'Daily attendance with absence alerts to parents',
      'Notices and homework with "seen by" tracking',
      'Fee structures, offline receipts and online payment',
      'Automatic fee-due reminders',
      'Progress reports to parents',
      'English, Kannada and Hindi',
    ],
  },
  {
    name: 'Premium',
    tagline: 'For growing schools that run office and accounts on it',
    price: 29999,
    students: 1000,
    extraStudent: 35,
    highlights: [
      'Everything in Basic',
      'Timetable with next-class reminders',
      'School calendar, events and PTMs',
      'Fee concessions and transfer certificates',
      'School bus routes with driver contact',
      'Shared documents, CSV reports',
      'Head office view for groups of schools',
      'School background and colours',
    ],
  },
  {
    name: 'Premium Max',
    tagline: 'For established schools that want payroll and AI',
    price: 60000,
    students: 2000,
    extraStudent: 30,
    highlights: [
      'Everything in Premium',
      'Admissions, front desk and syllabus progress',
      'Petty cash, live bus tracking and library',
      'HR and payroll: PF, ESI, PT, payslips and leave',
      'AI assistant, notice translation, report remarks',
      'Early warnings and a Monday summary',
      'Named account manager, on-site training day',
    ],
  },
];

/** One comparison row: true / false, or text for the three plans in order. */
export type Cell = boolean | string;
export interface ComparisonGroup {
  title: string;
  rows: [string, Cell, Cell, Cell][];
}

export const COMPARISON: ComparisonGroup[] = [
  {
    title: 'Parents and teachers',
    rows: [
      [
        'Mobile app for parents and teachers, phone OTP login',
        true,
        true,
        true,
      ],
      ['Notices and homework with "seen by" lists', true, true, true],
      ['Push notifications', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Progress reports with read receipts', true, true, true],
      ['English, Kannada and Hindi', true, true, true],
      ['Timetable and next-class reminders', false, true, true],
      ['School calendar with events and PTMs', false, true, true],
      ['Shared staff documents', false, true, true],
      ['School bus routes, stops and driver contact', false, true, true],
      ['Live bus tracking and library', false, false, true],
    ],
  },
  {
    title: 'Attendance',
    rows: [
      ['Daily attendance with absence alerts', true, true, true],
      ['Attendance report with CSV download', false, true, true],
    ],
  },
  {
    title: 'Fees and money',
    rows: [
      ['Fee structures and student fee assignments', true, true, true],
      ['Online payment by UPI, card and net banking', true, true, true],
      ['Offline payment receipts and fee-due reminders', true, true, true],
      ['Fee reports with CSV download', false, true, true],
      ['Fee concessions', false, true, true],
      ['Petty-cash ledger with approvals', false, false, true],
    ],
  },
  {
    title: 'Office',
    rows: [
      ['Student records, parent linking and photos', true, true, true],
      ['Excel import of classes, staff, students and fees', true, true, true],
      ['Transfer certificates', false, true, true],
      ['Admissions, front desk and syllabus progress', false, false, true],
      ['School background and colours', false, true, true],
    ],
  },
  {
    title: 'HR, payroll and AI',
    rows: [
      ['Staff records, leave and payroll (PF, ESI, PT, payslips)', false, 'Add-on', true],
      ['AI assistant, translation and early warnings', false, 'Add-on', true],
    ],
  },
  {
    title: 'Service',
    rows: [
      ['Students included', '400', '1,000', '2,000'],
      ['Each extra student, per year', '₹40', '₹35', '₹30'],
      ['Setup, data import and online training', true, true, true],
      ['Support', 'Email', 'Email + WhatsApp', 'Named manager'],
      ['On-site training day', false, false, '1 a year'],
    ],
  },
];

export const ADD_ONS: [string, number][] = [
  ['HR and payroll (Premium)', 18000],
  ['AI insights (Premium)', 15000],
];

export const TERMS = [
  'Prices are per school per year and exclude 18% GST.',
  'Billed yearly in advance from the start of the academic year.',
  'Setup, import of your existing Excel data and online staff training are free.',
  'Online fee payments go to the school’s own Razorpay account. Schoolinkd takes no commission; Razorpay charges its own fee.',
  'SMS other than login OTP is billed at cost. Push notifications are unlimited.',
  'Moving to a higher plan during the year is charged pro rata.',
  'The school owns its data and can export it at any time.',
];

/** Same WhatsApp number as the marketing site (web-admin lib/marketing-config.ts). */
export const CONTACT_LINE =
  'Book a free demo: WhatsApp +91 77957 57002 · schoolinkd.in';

/**
 * Schools with several branches (docs/SPEC-franchise.md §5): each branch pays
 * by its size with Premium features, Premium Max adds a fixed amount, branch
 * fees get a volume discount, and the head office pays a yearly fee that is
 * waived for large groups. Groups of 1–2 branches pay single-school prices.
 */
export const FRANCHISE_PRICING = {
  minBranches: 3,
  bands: [
    { upTo: 150, price: 12000, label: 'Up to 150 students' },
    { upTo: 500, price: 20000, label: '151 to 500 students' },
    { upTo: 1000, price: 29999, label: '501 to 1,000 students' },
  ],
  /** Per student above the largest band. */
  extraStudent: 30,
  premiumMaxAddOn: 12000,
  discounts: [
    { minBranches: 25, percent: 20 },
    { minBranches: 10, percent: 15 },
    { minBranches: 3, percent: 10 },
  ],
  headOffice: { price: 15000, freeFromBranches: 10 },
} as const;
