'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import {
  AlarmClock,
  BellRing,
  BookOpenCheck,
  Briefcase,
  Building2,
  Bus,
  CalendarCheck,
  ClipboardCheck,
  Eye,
  FileBadge,
  FileSpreadsheet,
  GraduationCap,
  HandCoins,
  ImageUp,
  IndianRupee,
  Languages,
  Plane,
  ReceiptIndianRupee,
  Siren,
  Smartphone,
  Sparkles,
  Sun,
  UserRoundPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { strings } from '../../lib/strings';
import { Eyebrow } from './eyebrow';
import { Section } from './section';

const t = strings.marketing.features;
type Tile = (typeof t.tabs)[number]['tiles'][number];

const ICONS: Record<Tile['icon'], LucideIcon> = {
  rupee: IndianRupee,
  bell: BellRing,
  check: CalendarCheck,
  admission: UserRoundPlus,
  sparkles: Sparkles,
  branches: Building2,
  receipt: ReceiptIndianRupee,
  payroll: Wallet,
  cash: HandCoins,
  bus: Bus,
  consent: ClipboardCheck,
  sheet: FileSpreadsheet,
  photo: ImageUp,
  eye: Eye,
  syllabus: BookOpenCheck,
  alarm: AlarmClock,
  leave: Plane,
  phone: Smartphone,
  alert: Siren,
  language: Languages,
  report: FileBadge,
  sun: Sun,
};

const TAB_ICONS: Record<(typeof t.tabs)[number]['id'], LucideIcon> = {
  owner: Briefcase,
  office: Building2,
  teacher: GraduationCap,
  parent: Users,
};

// Literal class names so Tailwind picks them up.
const TONES: Record<Tile['tone'], { chip: string; dot: string }> = {
  emerald: { chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  coral: { chip: 'bg-coral/10 text-coral-dark', dot: 'bg-coral' },
  sky: { chip: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  violet: { chip: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  amber: { chip: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  teal: { chip: 'bg-teal/10 text-teal', dot: 'bg-teal' },
};

/**
 * Every feature on one screen: pick who you are (owner, office, teacher,
 * parent) and see six short tiles, each with a sample of what it shows.
 */
export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = t.tabs[active];

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + t.tabs.length) % t.tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Section tone="light" id="features" className="scroll-mt-24 py-8! sm:scroll-mt-16 sm:py-10!">
      <div className="mx-auto max-w-2xl text-center">
        <div className="hidden sm:block">
          <Eyebrow tone="teal">{t.eyebrow}</Eyebrow>
        </div>
        <h2 className="text-xl sm:mt-3 sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900">{t.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      <div
        role="tablist"
        aria-label={t.subtitle}
        onKeyDown={onKeyDown}
        className="mx-auto mt-5 grid max-w-xl grid-cols-4 gap-1 rounded-full bg-gray-100 p-1"
      >
        {t.tabs.map((item, i) => {
          const Icon = TAB_ICONS[item.id];
          const selected = i === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`feature-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="feature-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:text-sm ${
                selected ? 'bg-teal text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        key={tab.id}
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`feature-tab-${tab.id}`}
        className="animate-fade-in mx-auto mt-5 grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
      >
        {tab.tiles.map((tile) => {
          const Icon = ICONS[tile.icon];
          const tone = TONES[tile.tone];
          const plan = 'plan' in tile ? tile.plan : undefined;
          const isNew = 'isNew' in tile && tile.isNew;
          return (
            <div
              key={tile.title}
              className="flex flex-col rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone.chip}`}>
                  <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden />
                </span>
                <span className="flex flex-col items-end gap-1">
                  {isNew && (
                    <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      {t.new}
                    </span>
                  )}
                  {plan && <span className="hidden text-[10px] font-semibold text-gray-400 sm:block">{plan}</span>}
                </span>
              </div>
              <h3 className="mt-2.5 text-sm font-bold leading-snug text-gray-900 sm:text-base">{tile.title}</h3>
              <p className="mt-1 hidden text-sm leading-snug text-gray-500 sm:line-clamp-2">{tile.line}</p>
              <div className="mt-auto pt-2.5 sm:pt-3">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold sm:text-xs ${tone.chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
                  {tile.visual}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
