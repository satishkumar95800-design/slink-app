import type { Metadata } from 'next';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Terms of Service — Slink' };

export default function TermsPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: September 18, 2026</p>

        <p className="mt-8 text-gray-700">
          These terms govern use of the Slink mobile app and admin web console (the &quot;Service&quot;),
          provided by Arins Studios (&quot;we&quot;, &quot;us&quot;). By creating an account or
          using the Service, you agree to these terms.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Accounts</h2>
        <p className="mt-4 text-gray-700">
          Parent and teacher accounts are created and linked to a school by that school&apos;s administrator.
          You are responsible for keeping your device and account access secure, and for the accuracy of
          information you submit through the Service.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">School&apos;s responsibility</h2>
        <p className="mt-4 text-gray-700">
          Each school using the Service is responsible for the accuracy of student, guardian, and fee data it
          enters or imports, and for obtaining any consents required from parents/guardians under applicable
          law before entering their data.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Payments</h2>
        <p className="mt-4 text-gray-700">
          Fee payments made through the Service are processed by Razorpay. See our{' '}
          <a href="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</a> for how refunds
          and payment disputes are handled.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Acceptable use</h2>
        <p className="mt-4 text-gray-700">
          Content sent through the Service (notices, homework, reports) must relate to legitimate school
          communication. We may suspend accounts used to send abusive, unlawful, or unrelated content.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Availability &amp; changes</h2>
        <p className="mt-4 text-gray-700">
          We aim to keep the Service available but do not guarantee uninterrupted access. We may update these
          terms from time to time; continued use after an update constitutes acceptance of the revised terms.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Contact us</h2>
        <p className="mt-4 text-gray-700">
          Questions about these terms can be sent to{' '}
          <a href="mailto:support@schoolinkd.in" className="text-blue-600 hover:underline">support@schoolinkd.in</a>.
        </p>
      </div>
    </Section>
  );
}
