'use client';

import { ChevronDown } from 'lucide-react';
import { ReactNode, useState } from 'react';

/**
 * One settings row: icon, title and a one-line summary. Clicking opens the
 * section's full content below it. The content mounts on first open (so a
 * section only loads its data when someone looks at it) and stays mounted
 * after, so a half-filled form survives closing and reopening.
 */
export function SettingsSection({
  id,
  icon,
  accent,
  title,
  summary,
  help,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: ReactNode;
  /** Tailwind classes for the icon chip, e.g. "bg-sky-50 text-sky-700". */
  accent: string;
  title: string;
  summary?: string | null;
  help?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  return (
    <section id={id} className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral/40 sm:px-5"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`} aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          <span className="mt-0.5 block truncate text-sm text-gray-500">{summary || ' '}</span>
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-label={title}
        hidden={!open && !mounted}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          {mounted && (
            <div className={`border-t border-gray-100 px-4 pb-5 pt-4 sm:px-5 ${open ? '' : 'invisible'}`}>
              {help && <p className="mb-4 text-sm text-gray-500">{help}</p>}
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A small heading above a group of settings rows. */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
