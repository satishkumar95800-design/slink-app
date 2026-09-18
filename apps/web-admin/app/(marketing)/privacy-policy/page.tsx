import type { Metadata } from 'next';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Privacy Policy — Slink' };

export default function PrivacyPolicyPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: [Date]</p>

        <p className="mt-8 text-gray-700">
          [Business/Legal Entity Name] (&quot;we&quot;, &quot;us&quot;) operates the Slink mobile app and admin
          web console (together, the &quot;Service&quot;), used by schools, teachers, and parents. This policy
          explains what information we collect, why, and how it is handled.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Information we collect</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
          <li>
            <strong>Account information</strong> — name, phone number, email address, and role (parent, teacher,
            admin, accounts staff), provided during sign-in or by your school&apos;s administrator.
          </li>
          <li>
            <strong>Student information</strong> — name, admission number, date of birth, class, blood group,
            and guardian relationships, provided by the school for the purpose of managing enrollment,
            fees, and reports.
          </li>
          <li>
            <strong>Fee and payment records</strong> — fee amounts, due dates, and payment status. Payments are
            processed by Razorpay; we do not store your card, UPI, or bank credentials.
          </li>
          <li>
            <strong>Reports, notices, and homework content</strong> — text and photos teachers create and send
            through the Service, and read receipts confirming delivery.
          </li>
          <li>
            <strong>Device and push notification tokens</strong> — used to deliver notices, fee reminders, and
            report notifications to your device.
          </li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">How we use this information</h2>
        <p className="mt-4 text-gray-700">
          Solely to operate the Service for your school: authenticating sign-in, showing the correct students/
          classes to the correct users, processing fee payments, and delivering reports and notifications. We do
          not sell personal information, and we do not use it for advertising.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Third-party services</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
          <li><strong>Firebase</strong> (Google) — phone number authentication and push notifications.</li>
          <li><strong>Razorpay</strong> — payment processing for fee payments.</li>
          <li><strong>Amazon Web Services (S3)</strong> — storage for uploaded photos, reports, and documents.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Data retention &amp; deletion</h2>
        <p className="mt-4 text-gray-700">
          We retain account and student data for as long as your school uses the Service. You can request
          deletion of your account and associated personal data at any time — see our{' '}
          <a href="/data-deletion" className="text-blue-600 hover:underline">Data Deletion</a> page for
          instructions.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Contact us</h2>
        <p className="mt-4 text-gray-700">
          Questions about this policy or your data can be sent to{' '}
          <a href="mailto:privacy@schoolinkd.in" className="text-blue-600 hover:underline">privacy@schoolinkd.in</a>.
        </p>
      </div>
    </Section>
  );
}
