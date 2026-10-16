import { buildPricingPdf } from './pricing-pdf';

describe('buildPricingPdf', () => {
  it('builds a two-page PDF: plans and terms, then the comparison table', async () => {
    const pdf = await buildPricingPdf(
      'Green Valley Public School',
      new Date('2026-10-16T06:00:00Z'),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  });
});
