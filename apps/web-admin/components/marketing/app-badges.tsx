'use client';

import { marketingConfig } from '../../lib/marketing-config';
import { track } from '../../lib/track';
import { strings } from '../../lib/strings';

const BADGE = 'inline-flex h-12 items-center gap-3 rounded-xl bg-black px-5 text-white transition-opacity hover:opacity-85';

/** Store badges; each one only renders once its listing URL is set in lib/marketing-config.ts. */
export function AppBadges() {
  const { playStoreUrl, appStoreUrl } = marketingConfig;
  if (!playStoreUrl && !appStoreUrl) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {playStoreUrl && (
        <a href={playStoreUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('store_click')} className={BADGE}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="currentColor">
            <path d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Zm11.6 8.8 2.6-2.6 3.2 1.8c.9.5.9 1.9 0 2.4l-3.2 1.8-2.6-2.6v-.8Zm-1 1.4-9.4 9.4 11.6-6.6-2.2-2.8Zm0-1.4-2.2-2.8L4.6 3.2Z" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-[10px] uppercase tracking-wide opacity-80">{strings.marketing.getItOn}</span>
            <span className="block text-sm font-semibold">Google Play</span>
          </span>
        </a>
      )}
      {appStoreUrl && (
        <a href={appStoreUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('store_click')} className={BADGE}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="currentColor">
            <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-2.9-4.2ZM13.8 4.9c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.2.1 2.3-.6 3-1.5Z" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-[10px] uppercase tracking-wide opacity-80">{strings.marketing.downloadOn}</span>
            <span className="block text-sm font-semibold">App Store</span>
          </span>
        </a>
      )}
    </div>
  );
}
