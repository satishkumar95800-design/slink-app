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
      'Petty-cash ledger with approvals',
      'Shared staff documents',
      'Attendance and fee reports (CSV)',
      'School background and colours',
    ],
  },
  {
    name: 'Gold',
    tagline: 'For established schools that want payroll and AI',
    price: 60000,
    students: 2000,
    extraStudent: 30,
    highlights: [
      'Everything in Premium',
      'HR and payroll: leave, PF, ESI, PT, payslips',
      'Staff payslips and leave in the app',
      'AI assistant for staff and parents',
      'AI notice translation and report remarks',
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
      ['Petty-cash ledger with approvals', false, true, true],
    ],
  },
  {
    title: 'Office',
    rows: [
      ['Student records, parent linking and photos', true, true, true],
      ['Excel import of classes, staff, students and fees', true, true, true],
      ['Transfer certificates', false, true, true],
      ['School background and colours', false, true, true],
    ],
  },
  {
    title: 'HR, payroll and AI',
    rows: [
      ['Staff records, attendance and leave', false, 'Add-on', true],
      ['Pay runs with PF, ESI, PT and payslip PDFs', false, 'Add-on', true],
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
