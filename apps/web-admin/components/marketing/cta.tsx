'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { whatsappUrl } from '../../lib/marketing-config';
import { track, type SiteEvent } from '../../lib/track';
import { strings } from '../../lib/strings';

const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#1FAF5A] px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-700/20 transition-colors hover:bg-[#178A47]';
const SECONDARY =
  'inline-flex items-center justify-center rounded-full border-2 border-teal px-7 py-3.5 text-sm font-bold text-teal transition-colors hover:bg-teal hover:text-white';

/** "Book a free demo on WhatsApp" — falls back to the contact form if no number is configured. */
export function WhatsAppDemoButton({ className = '', label = strings.marketing.bookDemo }: { className?: string; label?: string }) {
  const href = whatsappUrl();
  if (!href) {
    return (
      <Link href="/contact" onClick={() => track('demo_click')} className={`${PRIMARY} ${className}`}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track('whatsapp_click')} className={`${PRIMARY} ${className}`}>
      <MessageCircle className="h-4 w-4" aria-hidden />
      {label}
    </a>
  );
}

export function TrackedLink({
  href,
  event,
  className = SECONDARY,
  children,
}: {
  href: string;
  event: SiteEvent;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={() => track(event)} className={className}>
      {children}
    </Link>
  );
}

/** Floating WhatsApp button, bottom-right on every marketing page. */
export function FloatingWhatsApp() {
  const href = whatsappUrl();
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('whatsapp_click')}
      aria-label={strings.marketing.bookDemo}
      className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#1FAF5A] text-white shadow-xl shadow-green-900/25 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}

/** Counts one page view per route change. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    track('page_view');
  }, [pathname]);
  return null;
}
