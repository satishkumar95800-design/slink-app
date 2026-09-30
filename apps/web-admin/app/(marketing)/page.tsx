import Link from 'next/link';
import {
  Bell,
  Camera,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import { Section } from '../../components/marketing/section';
import { Container } from '../../components/marketing/container';
import { FeatureCard } from '../../components/marketing/feature-card';
import { Eyebrow } from '../../components/marketing/eyebrow';
import { Marquee } from '../../components/marketing/marquee';
import { Checklist } from '../../components/marketing/checklist';
import { FloatingStat } from '../../components/marketing/floating-stat';
import { DashboardMockup } from '../../components/marketing/dashboard-mockup';

const TICKER_ITEMS = [
  'STUDENT NOTES, MOM & COMPLAINT LOG',
  'REPORT CARD PDF UPLOADS',
  'DISCOUNT-AWARE RECEIPTS',
  'PAYMENT-CLAIM PROOF UPLOADS',
  'YEARLY FEE SUMMARY PER STUDENT',
  'SMART TIMETABLE CONFLICT CHECKS',
  'ROLE-SCOPED WEB CONSOLE',
  'BULK ONBOARDING IN ONE IMPORT',
];

const HOW_IT_WORKS = [
  {
    number: '01',
    icon: Upload,
    title: 'Import your school in one go',
    description:
      'Upload one spreadsheet to create classes, staff accounts, students, parents, and fee structures — no manual data entry.',
  },
  {
    number: '02',
    icon: Wallet,
    title: 'Parents pay, or show their proof',
    description:
      'Parents pay online from the app, or upload a photo of a cash/cheque payment as a claim for accounts to verify and record.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Teachers publish reports & report cards',
    description:
      'Academic, attendance, and behaviour reports, plus uploaded report-card PDFs — published straight to a parent’s phone.',
  },
  {
    number: '04',
    icon: LayoutDashboard,
    title: 'Admins and accounts run the office',
    description:
      'One console, scoped by role — collections, outstanding dues, teacher workload, and a running notes log per student.',
  },
];

const MOBILE_FEATURES = [
  {
    icon: CreditCard,
    title: 'Fee payments & claims',
    description:
      'Parents pay online, or attach a photo of an offline payment as a claim — with discount labels shown on every receipt.',
  },
  {
    icon: FileText,
    title: 'Progress reports & report cards',
    description: 'Teachers publish academic, attendance, and behaviour reports, plus upload signed report-card PDFs.',
  },
  {
    icon: Bell,
    title: 'Class notices',
    description: 'A class teacher can broadcast a message to every parent in their class in seconds.',
  },
  {
    icon: Camera,
    title: 'Homework, with a photo',
    description: 'Teachers snap a photo of the board and send it straight to a class’s parents.',
  },
];

const WEB_FEATURES = [
  {
    icon: Users,
    title: 'Students, classes & teachers',
    description: 'Manage rosters, class-teacher assignments, and subject/class teaching loads in one place.',
  },
  {
    icon: Upload,
    title: 'Bulk onboarding',
    description: 'Import classes, staff, teachers, students, and fee structures from a single spreadsheet.',
  },
  {
    icon: Receipt,
    title: 'Fees, discounts & collections',
    description:
      'Set up fee plans, discounts, and transport slabs — a dashboard that now correctly counts every cash payment too.',
  },
  {
    icon: MessageSquareText,
    title: 'A notes log for every student',
    description: 'Teachers and admins record MOMs, complaints, and parent discussions — never shown to parents.',
  },
  {
    icon: Wallet,
    title: 'Yearly fee summary per student',
    description: 'Accountants open any student to see the full-year due/paid/pending breakdown, term by term.',
  },
  {
    icon: ShieldCheck,
    title: 'Fewer scheduling mistakes',
    description: 'The timetable warns an admin when a teacher is assigned a subject they aren’t actually teaching.',
  },
  {
    icon: LayoutDashboard,
    title: 'Fee structures & reporting',
    description: 'Collection forecasts, workload views, and student-wise reports, kept current in real time.',
  },
  {
    icon: Smartphone,
    title: 'One console, every role',
    description: 'Admins, accounts staff, and teachers each get the views and actions their role needs — nothing more.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Section tone="cream" className="pt-14 pb-0 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>For school admins, teachers &amp; parents</Eyebrow>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Run fees, reports and notices from{' '}
              <span className="relative inline-block">
                <span className="relative z-10">one place</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-4 bg-coral/30" />
              </span>
              , not a dozen registers.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-gray-600">
              Slink pairs a parent &amp; teacher mobile app with an admin web console — bulk onboarding, discount-aware
              fee collection, payment-claim proofs, teacher-authored report cards, and a running notes log for every
              student.
            </p>
            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-coral/20 transition-colors hover:bg-coral-dark"
              >
                School Login
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-full border-2 border-teal px-7 py-3.5 text-sm font-bold text-teal transition-colors hover:bg-teal hover:text-white"
              >
                Talk to us
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              For school administrators and accounts staff. Parents and teachers use the Slink mobile app.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-gray-200 pt-6 sm:max-w-md">
              <div>
                <p className="text-2xl font-extrabold text-gray-900">4</p>
                <p className="text-xs text-gray-500">Roles supported</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">4</p>
                <p className="text-xs text-gray-500">Payment methods</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-900">1</p>
                <p className="text-xs text-gray-500">Import to set up</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <DashboardMockup />
            <FloatingStat
              icon={ShieldCheck}
              label="Discount applied"
              value="−₹2,000"
              caption="Sibling discount"
              className="absolute -right-2 top-6 hidden sm:block"
            />
            <FloatingStat
              icon={FileText}
              label="Report card ready"
              value="Term 2"
              caption="Published to parent"
              className="absolute -left-4 bottom-8 hidden sm:block"
            />
          </div>
        </div>
      </Section>

      <div className="mt-14">
        <Marquee items={TICKER_ITEMS} />
      </div>

      <Section tone="light" id="how-it-works">
        <Eyebrow tone="teal">How it works</Eyebrow>
        <h2 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Four steps from a spreadsheet to a school that runs itself.
        </h2>
        <div className="mt-12 divide-y divide-gray-100 border-y border-gray-100">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.number} className="flex flex-col gap-4 py-7 sm:flex-row sm:items-start sm:gap-8">
              <span className="text-3xl font-extrabold text-coral/50">{step.number}</span>
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-teal/10 text-teal">
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                <p className="mt-1 max-w-xl text-sm text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Every rupee accounted for</Eyebrow>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              Collections that add up, on cash and online alike.
            </h2>
            <p className="mt-3 text-gray-600">
              Discounts, payment-claim proofs, and cash receipts now all flow into the same dashboard — so
              &quot;Recent Payments&quot; and collection totals finally match what accounts actually collected.
            </p>
            <Checklist
              items={[
                'Discount type and amount shown on every receipt, not just the accountant’s form',
                'Parents attach a photo as proof of an offline payment for accounts to verify',
                'The admin dashboard now counts cash and cheque payments, not gateway-only',
                'Accountants open any student for a full-year due / paid / pending breakdown by term',
              ]}
            />
          </div>
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <p className="text-sm font-bold text-gray-900">Yearly Fee Summary — Aarav Mehta</p>
              <span className="rounded-full bg-coral/10 px-2.5 py-1 text-[10px] font-bold uppercase text-coral-dark">
                2026-27
              </span>
            </div>
            {[
              { label: 'Term 1 — Tuition', due: '₹18,000', paid: '₹18,000', status: 'Paid' },
              { label: 'Term 2 — Tuition', due: '₹18,000', paid: '₹12,000', status: 'Partial' },
              { label: 'Transport — Q3', due: '₹6,000', paid: '₹0', status: 'Pending' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-700">{row.label}</span>
                <span className="text-gray-400">{row.paid} / {row.due}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    row.status === 'Paid'
                      ? 'bg-green-100 text-green-800'
                      : row.status === 'Partial'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-teal/5 px-4 py-3">
              <span className="text-sm font-bold text-teal">Yearly pending</span>
              <span className="text-sm font-extrabold text-teal">₹12,000</span>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="light">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm lg:order-1">
            <p className="text-sm font-bold text-gray-900">Notes — Aarav Mehta</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-gray-100 p-3">
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                  Minutes of Meeting
                </span>
                <p className="mt-2 text-xs text-gray-600">
                  Met with parents about attendance — agreed on a weekly check-in note home.
                </p>
                <p className="mt-2 text-[10px] text-gray-400">Krishna Verma · Class Teacher</p>
              </div>
              <div className="rounded-xl border border-gray-100 p-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                  Note
                </span>
                <p className="mt-2 text-xs text-gray-600">Improved a lot in this term&apos;s mathematics assessment.</p>
                <p className="mt-2 text-[10px] text-gray-400">Admin Office</p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Eyebrow tone="teal">A paper trail for every student</Eyebrow>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
              Report cards, reports, and the conversations in between.
            </h2>
            <p className="mt-3 text-gray-600">
              Beyond published progress reports, teachers can now log minutes of meeting, complaints, and
              parent-discussion notes against a student — visible to teachers and admins only, never parents.
            </p>
            <Checklist
              items={[
                'Teachers upload a signed report-card PDF and publish it straight to the parent app',
                'A running notes log — type it once as a note, MOM, complaint, or parent discussion',
                'Admins see every student’s notes across the school; teachers see their own classes',
                'Report cards and notes are stored separately — nothing internal ever reaches a parent',
              ]}
            />
          </div>
        </div>
      </Section>

      <Section tone="cream">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>A mobile app parents and teachers actually use</Eyebrow>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            Everything a family or teacher needs, day to day.
          </h2>
          <p className="mt-3 text-gray-600">Phone-number sign-in and push notifications, built for daily use.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MOBILE_FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section tone="light" id="features">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="teal">A web console that runs the school office</Eyebrow>
          <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            Everything the front office and accounts team need.
          </h2>
          <p className="mt-3 text-gray-600">Scoped by role, kept current, in a browser.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WEB_FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section tone="cream">
        <div className="rounded-3xl border border-black/5 bg-white p-10 shadow-sm sm:p-14">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl">
                Your next term is one import away.
              </h2>
              <p className="mt-4 text-gray-600">Sign in to your admin console, or talk to us about onboarding your school.</p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-coral/20 transition-colors hover:bg-coral-dark"
                >
                  School Login
                </Link>
                <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-bold text-teal hover:underline">
                  Talk to our team first
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
