import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '../../components/marketing/container';

export const metadata: Metadata = {
  title: 'Slink — School Management, Simplified',
  description:
    'Slink helps schools automate fees, reports, notices, and homework — a mobile app for parents and teachers, and a web console for administrators.',
};

const NAV_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Refund Policy', href: '/refund-policy' },
  { label: 'Contact', href: '/contact' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans flex min-h-full flex-col">
      <header className="border-b border-gray-200 bg-white">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
              S
            </div>
            <span className="text-sm font-bold tracking-tight text-gray-900">Slink</span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-gray-600 hover:text-gray-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Login
          </Link>
        </Container>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-white">
        <Container className="flex flex-col items-center justify-between gap-4 py-8 text-sm text-gray-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} Arins Studios. All rights reserved.</p>
          <nav className="flex flex-wrap items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-gray-700">
                {link.label}
              </Link>
            ))}
            <Link href="/data-deletion" className="hover:text-gray-700">
              Data Deletion
            </Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}
