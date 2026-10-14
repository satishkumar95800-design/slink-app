'use client';

import { useTranslations } from 'next-intl';
import { ReactNode, useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Shown in a coloured square next to the title. */
  icon?: ReactNode;
  /** Tailwind classes for the icon square, e.g. "bg-emerald-100 text-emerald-700". */
  accent?: string;
  children: ReactNode;
}

/** Slide-over panel from the right (full screen on phones), for a section's full view. */
export function Drawer({ open, onClose, title, subtitle, icon, accent = 'bg-teal/10 text-teal', children }: DrawerProps) {
  const t = useTranslations('common');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-teal/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-2xl flex-col bg-cream shadow-2xl animate-slide-in-right sm:rounded-l-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-black/5 px-4 py-4 sm:px-6 sm:py-5">
          {icon && <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${accent}`}>{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="text-lg font-extrabold text-gray-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700"
            aria-label={t('close')}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
