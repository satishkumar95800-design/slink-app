import { ReactNode } from 'react';
import { Container } from './container';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Vertical padding + background tone. 'dark' uses the deep teal brand color. */
  tone?: 'light' | 'muted' | 'dark' | 'cream';
}

const toneClasses: Record<NonNullable<SectionProps['tone']>, string> = {
  light: 'bg-white text-gray-900',
  muted: 'bg-gray-50 text-gray-900',
  dark: 'bg-teal text-white',
  cream: 'bg-cream text-gray-900',
};

export function Section({ children, className = '', id, tone = 'light' }: SectionProps) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${toneClasses[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
