import { ImageResponse } from 'next/og';

export const alt = 'Schoolinkd — know exactly how much fee your school collected, every day';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Share card for WhatsApp / LinkedIn, rendered at build time — no image file to maintain. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#FBF3EA',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: '#123E3B',
              color: '#FBF3EA',
              fontSize: 44,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            S
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#123E3B' }}>Schoolinkd</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 62, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>
            Know exactly how much fee your school collected — every day.
          </div>
          <div style={{ fontSize: 30, color: '#4B5563' }}>Cash, cheque &amp; online in one dashboard · Parent &amp; teacher app</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#E8623D', color: 'white', fontSize: 28, fontWeight: 700, padding: '14px 28px', borderRadius: 999 }}>
            Book a free demo
          </div>
          <div style={{ fontSize: 28, color: '#123E3B' }}>schoolinkd.in</div>
        </div>
      </div>
    ),
    size,
  );
}
