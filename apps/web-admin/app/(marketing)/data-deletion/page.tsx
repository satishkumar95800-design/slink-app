import type { Metadata } from 'next';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Data Deletion — Slink' };

export default function DataDeletionPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">Account &amp; Data Deletion</h1>

        <p className="mt-8 text-gray-700">
          You can request deletion of your Slink account and the personal data associated with it at any time.
          This currently requires a request to our support team (there is no self-service delete option in the
          app yet).
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">How to request deletion</h2>
        <p className="mt-4 text-gray-700">
          Email <a href="mailto:[Support Email]" className="text-blue-600 hover:underline">[Support Email]</a>{' '}
          from the email address or phone number linked to your account, with the subject &quot;Account
          Deletion Request&quot;. Include your name, your school&apos;s name, and the phone number you use to
          sign in.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">What gets deleted</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
          <li>Your account profile (name, phone number, email) and login credentials.</li>
          <li>Push notification tokens registered to your device.</li>
          <li>Your read/notification history within the app.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">What may be retained</h2>
        <p className="mt-4 text-gray-700">
          Fee payment records and receipts are retained by the school for accounting and legal/tax record-
          keeping purposes even after an account is deleted, as is standard for financial records. Student
          academic records remain part of the school&apos;s records and are managed by the school
          administrator, not deleted alongside a parent/teacher account.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Processing time</h2>
        <p className="mt-4 text-gray-700">
          We aim to complete deletion requests within [X] business days of verifying your identity.
        </p>
      </div>
    </Section>
  );
}
