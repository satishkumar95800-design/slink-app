import { Prisma } from '@prisma/client';
import { buildReceiptPdf, ReceiptPdfInput } from './receipt-pdf';

export const sampleReceipt: ReceiptPdfInput = {
  receiptNumber: 'RCPT-2026-00042',
  amount: new Prisma.Decimal('21400'),
  method: 'cash',
  reference: null,
  paidOn: new Date('2026-10-03T00:00:00.000Z'),
  discountAmount: new Prisma.Decimal('1000'),
  discountNote: 'Second child',
  student: { name: 'Aditya Iyer', admissionNo: 'ADM-2025-0052' },
  class: { name: 'Class 4', section: 'A', academicYear: '2025-26' },
  studentFee: { feeStructure: { name: 'Term 1', academicYear: '2025-26' } },
  recordedByUser: { name: 'Gayathri' },
  discountType: { name: 'Sibling' },
  tenant: { name: 'Green Valley Public School', branding: { address: 'MG Road, Bengaluru', contactPhone: '+91 80 1234 5678' } },
};

describe('buildReceiptPdf', () => {
  it('renders a non-empty PDF with the bundled ₹-capable font', async () => {
    const pdf = await buildReceiptPdf(sampleReceipt, new Date('2026-10-08T06:00:00Z'));

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
    expect(pdf.toString('latin1')).toContain('NotoSans');
  });
});
