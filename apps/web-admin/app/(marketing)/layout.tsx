import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '../../components/marketing/container';
import { FloatingWhatsApp, PageViewTracker, WhatsAppDemoButton } from '../../components/marketing/cta';
import { marketingConfig } from '../../lib/marketing-config';
import { strings } from '../../lib/strings';

export const metadata: Metadata = {
  metadataBase: new URL(marketingConfig.siteUrl),
  title: strings.marketing.metaTitle,
  description: strings.marketing.metaDescription,
  openGraph: {
    type: 'website',
    siteName: 'Schoolinkd',
    url: marketingConfig.siteUrl,
    title: strings.marketing.metaTitle,
    description: strings.marketing.metaDescription,
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image', title: strings.marketing.metaTitle, description: strings.marketing.metaDescription },
};

const NAV_LINKS = [
  { label: 'Why us', href: '/#why' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Contact', href: '/contact' },
];

const EXPLORE_LINKS = [
  { label: 'Why schools switch', href: '/#why' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Refund Policy', href: '/refund-policy' },
  { label: 'Data Deletion', href: '/data-deletion' },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans flex min-h-full flex-col bg-cream">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-cream/90 backdrop-blur">
        <Container className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-sm font-extrabold text-white">
              S
            </div>
            <span className="text-sm font-extrabold tracking-tight text-gray-900">Schoolinkd</span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-gray-700 hover:text-gray-900">
                {link.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-coral px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-coral-dark"
          >
            School Login
          </Link>
        </Container>
        <Container className="flex gap-5 overflow-x-auto pb-3 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm font-medium text-gray-700">
              {link.label}
            </Link>
          ))}
        </Container>
      </header>

      <main className="flex-1">{children}</main>
      <PageViewTracker />
      <FloatingWhatsApp />

      <footer className="border-t border-black/5 bg-gray-50">
        <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-sm font-extrabold text-white">
                S
              </div>
              <span className="text-sm font-extrabold tracking-tight text-gray-900">Schoolinkd</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-600">
              Schoolinkd brings cash, cheque and online fee collection into one dashboard, with a parent &amp; teacher
              app for attendance, homework, notices and report cards.
            </p>
            <WhatsAppDemoButton className="mt-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Explore</h4>
            <ul className="mt-4 space-y-3">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Legal</h4>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-gray-600 hover:text-gray-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
        <div className="border-t border-black/5 py-6">
          <Container>
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Arins Studios. All rights reserved.</p>
          </Container>
        </div>
      </footer>
    </div>
  );
}
