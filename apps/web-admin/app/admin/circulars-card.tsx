'use client';

import { Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api-client';
import { formatDateOnly } from '../../lib/format';

interface Circular {
  id: string;
  title: string;
  body: string;
  from: string;
  createdAt: string;
}

/** Circulars from the school's head office (franchise groups only); hidden when there are none. */
export function HeadOfficeCirculars() {
  const t = useTranslations('circulars');
  const [items, setItems] = useState<Circular[]>([]);
  const [all, setAll] = useState(false);

  useEffect(() => {
    api.get<Circular[]>('/circulars').then(setItems).catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, 2);
  return (
    <section className="rounded-3xl border border-teal/15 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal/10 text-teal">
          <Building2 className="h-4 w-4" />
        </span>
        {t('title', { group: items[0].from })}
      </h2>
      <ul className="mt-3 space-y-3">
        {shown.map((c) => (
          <li key={c.id} className="rounded-2xl bg-cream/60 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{c.title}</p>
              <p className="text-xs text-gray-500">{formatDateOnly(c.createdAt)}</p>
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{c.body}</p>
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 cursor-pointer text-sm font-semibold text-teal underline">
          {all ? t('showFewer') : t('showAll', { count: items.length })}
        </button>
      )}
    </section>
  );
}
