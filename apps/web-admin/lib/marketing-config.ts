/**
 * Marketing-site settings (docs/SPEC-improvements.md Phase 5). Change values
 * here only — every section reads from this file. Empty strings / false hide
 * the related section or element.
 */
export const marketingConfig = {
  siteUrl: 'https://schoolinkd.in',

  /** International format, digits only (91 + 10-digit mobile). */
  whatsappNumber: '917795757002',
  /** Fixed message only — never put personal data in the wa.me URL. */
  whatsappMessage: "Hi, I'd like a demo of Schoolinkd for my school.",

  /** YouTube video id (the part after watch?v=). Empty shows a "coming soon" placeholder. */
  demoVideoYoutubeId: '',

  /** Flip to true once real testimonials replace the placeholders in components/marketing/testimonials.tsx. */
  showTestimonials: false,

  /** Price per student per year in rupees; the number shows only when showPrice is true. */
  showPrice: false,
  pricePerStudentPerYear: 0,

  /** Store listings; a badge is hidden while its link is empty. */
  playStoreUrl: '',
  appStoreUrl: '',
} as const;

export function whatsappUrl(): string | null {
  const { whatsappNumber, whatsappMessage } = marketingConfig;
  if (!whatsappNumber) return null;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
}
