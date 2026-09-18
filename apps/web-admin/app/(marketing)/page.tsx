import Link from 'next/link';
import {
  Bell,
  Camera,
  CreditCard,
  FileText,
  LayoutDashboard,
  Smartphone,
  Upload,
  Users,
} from 'lucide-react';
import { Section } from '../../components/marketing/section';
import { FeatureCard } from '../../components/marketing/feature-card';

const MOBILE_FEATURES = [
  {
    icon: CreditCard,
    title: 'Fee payments',
    description: 'Parents view dues and pay online — no more chasing paper receipts.',
  },
  {
    icon: FileText,
    title: 'Progress reports',
    description: 'Teachers publish academic, attendance, and behavior reports parents can read anytime.',
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
    icon: LayoutDashboard,
    title: 'Fee structures & reporting',
    description: 'Set up fee plans, discounts, and transport slabs, and track collections in real time.',
  },
  {
    icon: Smartphone,
    title: 'One console, every role',
    description: 'Admins, accounts staff, and teachers each get the views and actions their role needs.',
  },
];

export default function LandingPage() {
  return (
    <>
      <Section tone="dark" className="pt-20 sm:pt-28">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            School management, automated end to end
          </h1>
          <p className="mt-6 text-lg text-slate-300">
            Slink pairs a parent &amp; teacher mobile app with an admin web console — fees, reports, notices,
            homework, and bulk onboarding, all in one connected system.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              School Login
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-md border border-slate-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Talk to us
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            For school administrators and accounts staff. Parents and teachers use the Slink mobile app.
          </p>
        </div>
      </Section>

      <Section tone="light">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">A mobile app parents and teachers actually use</h2>
          <p className="mt-3 text-gray-600">
            Phone-number sign-in, push notifications, and everything a family or teacher needs day to day.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MOBILE_FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">A web console that runs the school office</h2>
          <p className="mt-3 text-gray-600">
            Everything the front office and accounts team need, scoped by role, in a browser.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WEB_FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </Section>

      <Section tone="dark">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Already using Slink at your school?</h2>
          <p className="mt-3 text-slate-300">Sign in to your admin console to get started.</p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            School Login
          </Link>
        </div>
      </Section>
    </>
  );
}
