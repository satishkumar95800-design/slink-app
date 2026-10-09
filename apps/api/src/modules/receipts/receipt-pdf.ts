import { join } from 'path';
import PDFDocument from 'pdfkit';
import { formatDateOnly, formatRupees } from '../../common/format';

/** Noto Sans ships the ₹ glyph that PDF's built-in Helvetica lacks. Copied to dist by nest-cli.json assets. */
const FONT_DIR = join(__dirname, 'fonts');
const REGULAR = join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = join(FONT_DIR, 'NotoSans-Bold.ttf');

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank transfer / UPI',
  demand_draft: 'Demand draft',
  gateway: 'Online payment',
};

const t = {
  title: 'Fee Receipt',
  receiptNo: 'Receipt No',
  date: 'Date',
  student: 'Student',
  admissionNo: 'Admission No',
  className: 'Class',
  fee: 'Fee',
  amount: 'Amount received',
  method: 'Payment method',
  reference: 'Reference',
  discount: (name: string | null) => (name ? `Discount (${name})` : 'Discount'),
  recordedBy: 'Recorded by',
  footer: (date: string) => `Computer-generated receipt · Schoolinkd · ${date}`,
};

export interface ReceiptPdfInput {
  receiptNumber: string;
  amount: { toString(): string };
  method: string;
  reference: string | null;
  paidOn: Date;
  discountAmount: { toString(): string } | null;
  discountNote: string | null;
  student: { name: string; admissionNo: string };
  class: { name: string; section: string | null; academicYear: string };
  studentFee: { feeStructure: { name: string; academicYear: string } };
  recordedByUser: { name: string } | null;
  discountType: { name: string } | null;
  tenant: { name: string; branding: unknown };
}

/** Renders one receipt as an A5 PDF and resolves with the bytes. */
export function buildReceiptPdf(
  receipt: ReceiptPdfInput,
  now: Date = new Date(),
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A5',
      margin: 36,
      info: { Title: `${t.title} ${receipt.receiptNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.registerFont('regular', REGULAR);
    doc.registerFont('bold', BOLD);

    const branding = (receipt.tenant.branding ?? {}) as {
      address?: string;
      contactPhone?: string;
      contactEmail?: string;
    };
    const width = doc.page.width - 72;

    // School header
    doc
      .font('bold')
      .fontSize(16)
      .fillColor('#123E3B')
      .text(receipt.tenant.name, { align: 'center' });
    const contact = [
      branding.address,
      branding.contactPhone,
      branding.contactEmail,
    ]
      .filter(Boolean)
      .join(' · ');
    if (contact)
      doc
        .font('regular')
        .fontSize(8)
        .fillColor('#555555')
        .text(contact, { align: 'center' });
    doc.moveDown(0.6);
    doc
      .font('bold')
      .fontSize(12)
      .fillColor('#E8623D')
      .text(t.title.toUpperCase(), { align: 'center', characterSpacing: 1 });
    doc.moveDown(0.4);
    rule(doc, width);

    const row = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc
        .font('regular')
        .fontSize(9)
        .fillColor('#666666')
        .text(label, 36, y, { width: width * 0.38 });
      doc
        .font(bold ? 'bold' : 'regular')
        .fontSize(bold ? 11 : 10)
        .fillColor('#111111')
        .text(value, 36 + width * 0.4, y, { width: width * 0.6 });
      doc.moveDown(0.35);
    };

    row(t.receiptNo, receipt.receiptNumber, true);
    row(t.date, formatDateOnly(receipt.paidOn));
    rule(doc, width);
    row(t.student, receipt.student.name, true);
    row(t.admissionNo, receipt.student.admissionNo);
    row(
      t.className,
      `${[receipt.class.name, receipt.class.section].filter(Boolean).join(' ')} (${receipt.class.academicYear})`,
    );
    row(
      t.fee,
      `${receipt.studentFee.feeStructure.name} (${receipt.studentFee.feeStructure.academicYear})`,
    );
    rule(doc, width);
    row(t.amount, formatRupees(receipt.amount), true);
    if (
      receipt.discountAmount &&
      Number(receipt.discountAmount.toString()) > 0
    ) {
      row(
        t.discount(receipt.discountType?.name ?? null),
        `−${formatRupees(receipt.discountAmount)}${receipt.discountNote ? ` · ${receipt.discountNote}` : ''}`,
      );
    }
    row(t.method, METHOD_LABELS[receipt.method] ?? receipt.method);
    if (receipt.reference) row(t.reference, receipt.reference);
    if (receipt.recordedByUser) row(t.recordedBy, receipt.recordedByUser.name);

    doc
      .font('regular')
      .fontSize(7)
      .fillColor('#888888')
      .text(
        t.footer(
          formatDateOnly(
            new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
              ),
            ),
          ),
        ),
        36,
        doc.page.height - 50,
        {
          width,
          align: 'center',
        },
      );

    doc.end();
  });
}

function rule(doc: PDFKit.PDFDocument, width: number) {
  doc.moveDown(0.2);
  doc
    .moveTo(36, doc.y)
    .lineTo(36 + width, doc.y)
    .lineWidth(0.5)
    .strokeColor('#DDDDDD')
    .stroke();
  doc.moveDown(0.5);
}
