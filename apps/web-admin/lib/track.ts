'use client';

/**
 * Cookie-free analytics: posts an event name + page path to our own API, which
 * only keeps daily totals. No ids, cookies or personal data are sent or stored.
 */
export type SiteEvent = 'page_view' | 'whatsapp_click' | 'demo_click' | 'login_click' | 'video_play' | 'store_click';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export function track(event: SiteEvent): void {
  if (typeof window === 'undefined') return;
  try {
    // keepalive lets the request finish even when the click navigates away.
    void fetch(`${API_BASE}/public/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never break the page.
  }
}
