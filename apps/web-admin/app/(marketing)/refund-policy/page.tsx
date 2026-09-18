import type { Metadata } from 'next';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Refund & Cancellation Policy — Slink' };

export default function RefundPolicyPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">Refund &amp; Cancellation Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: [Date]</p>

        <p className="mt-8 text-gray-700">
          Fee payments made through Slink are collected by [Business/Legal Entity Name] on behalf of your
          school and processed via Razorpay. This policy covers refunds for those payments.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Requesting a refund</h2>
        <p className="mt-4 text-gray-700">
          If a fee payment was made in error, made twice, or needs to be refunded for any other reason,
          contact your school&apos;s accounts office directly, or write to{' '}
          <a href="mailto:[Support Email]" className="text-blue-600 hover:underline">[Support Email]</a> with
          the payment date, amount, and student/admission number. Refund decisions for school fees are made by
          the school; we facilitate the transaction on the school&apos;s behalf.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Processing time</h2>
        <p className="mt-4 text-gray-700">
          Approved refunds are typically returned to the original payment method within [X] business days,
          subject to Razorpay&apos;s and your bank&apos;s processing times.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Failed or duplicate payments</h2>
        <p className="mt-4 text-gray-700">
          If a payment is deducted from your account but not reflected as successful in the app, do not retry
          immediately — contact us with the transaction reference and we will verify the payment status with
          Razorpay before any refund or retry.
        </p>

        <h2 className="mt-10 text-xl font-semibold text-gray-900">Contact us</h2>
        <p className="mt-4 text-gray-700">
          For any payment issue, reach us at{' '}
          <a href="mailto:[Support Email]" className="text-blue-600 hover:underline">[Support Email]</a> or see
          our <a href="/contact" className="text-blue-600 hover:underline">Contact</a> page.
        </p>
      </div>
    </Section>
  );
}
