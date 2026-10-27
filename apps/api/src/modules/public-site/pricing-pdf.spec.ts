import { buildPricingPdf } from './pricing-pdf';

describe('buildPricingPdf', () => {
  it('builds a four-page PDF: plans and terms, the comparison table (two pages), then group pricing', async () => {
    const pdf = await buildPricingPdf(
      'Green Valley Public School',
      new Date('2026-10-16T06:00:00Z'),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(4);
  });
});
