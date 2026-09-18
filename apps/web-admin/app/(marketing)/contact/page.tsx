import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Section } from '../../../components/marketing/section';

export const metadata: Metadata = { title: 'Contact — Slink' };

export default function ContactPage() {
  return (
    <Section tone="light">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-gray-900">Contact Us</h1>
        <p className="mt-3 text-gray-600">
          For sales, support, or payment queries, reach us through any of the channels below.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <Mail className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm font-medium text-gray-900">Email</p>
          <a href="mailto:support@schoolinkd.in" className="mt-1 text-sm text-gray-600 hover:text-blue-600">
            support@schoolinkd.in
          </a>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <Phone className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm font-medium text-gray-900">Phone</p>
          <a href="tel:+917259708722" className="mt-1 text-sm text-gray-600 hover:text-blue-600">
            +91 72597 08722
          </a>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <MapPin className="h-6 w-6 text-blue-600" />
          <p className="mt-3 text-sm font-medium text-gray-900">Address</p>
          <p className="mt-1 text-sm text-gray-600">Bommanahalli, Bengaluru</p>
        </div>
      </div>
    </Section>
  );
}
