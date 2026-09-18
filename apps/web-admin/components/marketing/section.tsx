import { ReactNode } from 'react';
import { Container } from './container';

interface SectionProps {
  children: ReactNode;
  className?: string;
  /** Vertical padding + background tone. 'dark' matches the admin sidebar's slate-900. */
  tone?: 'light' | 'muted' | 'dark';
}

const toneClasses: Record<NonNullable<SectionProps['tone']>, string> = {
  light: 'bg-white text-gray-900',
  muted: 'bg-gray-50 text-gray-900',
  dark: 'bg-slate-900 text-white',
};

export function Section({ children, className = '', tone = 'light' }: SectionProps) {
  return (
    <section className={`py-16 sm:py-20 ${toneClasses[tone]} ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}
