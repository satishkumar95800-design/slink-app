import type { Metadata } from 'next';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Data Deletion — Schoolinkd' };

export default function DataDeletionPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">Account &amp; Data Deletion</h1>

        <p className="mt-8 text-gray-700">
          You can delete your Schoolinkd account and the personal data linked to it at any time, straight from
          the app.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Delete your account in the app</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-gray-700">
          <li>Open the Schoolinkd app and sign in.</li>
          <li>Tap <strong>Profile</strong>.</li>
          <li>Tap <strong>Delete my account</strong>, read what will be deleted, and tap <strong>Delete account</strong>.</li>
        </ol>
        <p className="mt-4 text-gray-700">
          Your account is deleted straight away and you are signed out on every phone.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">If you can&apos;t use the app</h2>
        <p className="mt-4 text-gray-700">
          Email <a href="mailto:support@schoolinkd.in" className="text-blue-600 hover:underline">support@schoolinkd.in</a>{' '}
          with the subject &quot;Account Deletion Request&quot;. Include your name, your school&apos;s name, and the
          phone number you use to sign in. We delete the account within 7 days of confirming the request
          comes from you.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">What gets deleted</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-gray-700">
          <li>Your name, phone number, email and sign-in details.</li>
          <li>Push notification tokens registered to your phones.</li>
          <li>Your notification history in the app.</li>
          <li>The link between your account and your children.</li>
        </ul>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">What may be retained</h2>
        <p className="mt-4 text-gray-700">
          Fee payment records and receipts are retained by the school for accounting and legal/tax record-
          keeping purposes even after an account is deleted, as is standard for financial records. Student
          academic records remain part of the school&apos;s records and are managed by the school
          administrator, not deleted alongside a parent/teacher account.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Using the app again</h2>
        <p className="mt-4 text-gray-700">
          A deleted account can&apos;t be restored. To use Schoolinkd again, ask your school to add your phone
          number; you then start with a new account.
        </p>
      </div>
    </Section>
  );
}
