import {
  CreditCard,
  Fingerprint,
  History,
  KeyRound,
  LockKeyhole,
  ScanSearch,
  School,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { strings } from '../../lib/strings';
import { Section } from './section';

const s = strings.marketing.security;

const ICONS: Record<(typeof s.items)[number]['icon'], LucideIcon> = {
  school: School,
  family: Users,
  code: KeyRound,
  fingerprint: Fingerprint,
  lock: LockKeyhole,
  card: CreditCard,
  scan: ScanSearch,
  history: History,
};

export function Security() {
  return (
    <Section tone="dark" id="security">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
          <ShieldCheck className="h-3.5 w-3.5" />
          {s.eyebrow}
        </span>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{s.title}</h2>
        <p className="mt-4 text-white/75">{s.subtitle}</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {s.items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/20 text-coral">
                  <Icon className="h-5 w-5" />
                </div>
                {'plan' in item && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                    {item.plan}
                  </span>
                )}
              </div>
              <h3 className="mt-4 font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{item.body}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-10 text-center text-xs text-white/60">{s.footnote}</p>
    </Section>
  );
}
