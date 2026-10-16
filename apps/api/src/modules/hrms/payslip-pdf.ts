import { join } from 'path';
import PDFDocument from 'pdfkit';
import { displayDate } from '../attendance/attendance-dates';
import { formatRupees } from '../../common/format';
import { PAYSLIP_TEXT as t } from './hrms.strings';
import { fromPaise } from './payroll.math';

/**
 * Same Noto Sans files as the fee receipt (they carry the rupee sign Helvetica
 * lacks). They are Latin only, so payslips are issued in English; Kannada or
 * Hindi names would print as blanks.
 */
const FONT_DIR = join(__dirname, '..', 'receipts', 'fonts');
const REGULAR = join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = join(FONT_DIR, 'NotoSans-Bold.ttf');

export interface PayslipInput {
  school: { name: string; address?: string; contact?: string };
  month: string;
  runStatus: string;
  paidAt: Date | null;
  paymentReference: string | null;
  employee: {
    code: string;
    name: string;
    designation: string;
    department: string | null;
    joinDate: string;
    panMasked: string | null;
    bankMasked: string | null;
  };
  periodDays: number;
  lopDays: number;
  paidDays: number;
  items: {
    kind: 'EARNING' | 'DEDUCTION';
    name: string;
    amountPaise: number;
    reason?: string | null;
    adjustment: boolean;
  }[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const money = (paise: number) => formatRupees(fromPaise(paise));

export function buildPayslipPdf(
  p: PayslipInput,
  now: Date = new Date(),
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: `${t.title} ${p.employee.code} ${p.month}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', REGULAR);
    doc.registerFont('bold', BOLD);

    const left = 40;
    const width = doc.page.width - 80;
    const rule = () => {
      doc
        .moveTo(left, doc.y)
        .lineTo(left + width, doc.y)
        .strokeColor('#CCCCCC')
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.5);
    };

    doc
      .font('bold')
      .fontSize(16)
      .fillColor('#123E3B')
      .text(p.school.name, left, 40, { align: 'center', width });
    const contact = [p.school.address, p.school.contact]
      .filter(Boolean)
      .join(' · ');
    if (contact)
      doc
        .font('regular')
        .fontSize(8)
        .fillColor('#555555')
        .text(contact, { align: 'center', width });
    doc.moveDown(0.6);
    doc
      .font('bold')
      .fontSize(12)
      .fillColor('#E8623D')
      .text(`${t.title.toUpperCase()} · ${monthLabel(p.month)}`, {
        align: 'center',
        width,
        characterSpacing: 1,
      });
    if (p.runStatus !== 'LOCKED') {
      doc
        .font('regular')
        .fontSize(8)
        .fillColor('#B00020')
        .text(t.draft, { align: 'center', width });
    }
    doc.moveDown(0.6);
    rule();

    const pairs: [string, string][] = [
      [t.employeeCode, p.employee.code],
      [t.name, p.employee.name],
      [t.designation, p.employee.designation],
      [t.department, p.employee.department ?? '-'],
      [t.joinDate, displayDate(p.employee.joinDate)],
      [t.pan, p.employee.panMasked ?? '-'],
      [t.bankAccount, p.employee.bankMasked ?? '-'],
      [t.periodDays, String(p.periodDays)],
      [t.lopDays, String(p.lopDays)],
      [t.paidDays, String(p.paidDays)],
    ];
    const colW = width / 2;
    let y = doc.y;
    pairs.forEach(([label, value], i) => {
      const x = left + (i % 2) * colW;
      if (i % 2 === 0 && i > 0) y += 18;
      doc
        .font('regular')
        .fontSize(8)
        .fillColor('#666666')
        .text(label, x, y, { width: colW * 0.4 });
      doc
        .font('regular')
        .fontSize(9)
        .fillColor('#111111')
        .text(value, x + colW * 0.4, y, { width: colW * 0.58 });
    });
    doc.y = y + 22;
    rule();

    const earnings = p.items.filter((i) => i.kind === 'EARNING');
    const deductions = p.items.filter((i) => i.kind === 'DEDUCTION');
    const tableTop = doc.y;
    const half = width / 2 - 10;
    const drawColumn = (
      x: number,
      title: string,
      rows: typeof p.items,
      total: number,
      totalLabel: string,
    ) => {
      let cy = tableTop;
      doc
        .font('bold')
        .fontSize(10)
        .fillColor('#123E3B')
        .text(title, x, cy, { width: half });
      cy += 18;
      for (const r of rows) {
        const label = r.adjustment ? `${r.name} (${t.adjustment})` : r.name;
        doc
          .font('regular')
          .fontSize(9)
          .fillColor('#111111')
          .text(label, x, cy, { width: half * 0.62 });
        doc.text(money(r.amountPaise), x + half * 0.62, cy, {
          width: half * 0.38,
          align: 'right',
        });
        cy += 15;
      }
      cy += 4;
      doc
        .moveTo(x, cy)
        .lineTo(x + half, cy)
        .strokeColor('#999999')
        .lineWidth(0.5)
        .stroke();
      cy += 4;
      doc
        .font('bold')
        .fontSize(9)
        .text(totalLabel, x, cy, { width: half * 0.62 });
      doc.text(money(total), x + half * 0.62, cy, {
        width: half * 0.38,
        align: 'right',
      });
      return cy + 18;
    };
    const endL = drawColumn(
      left,
      t.earnings,
      earnings,
      p.grossPaise,
      t.grossEarnings,
    );
    const endR = drawColumn(
      left + half + 20,
      t.deductions,
      deductions,
      p.deductionsPaise,
      t.totalDeductions,
    );
    doc.y = Math.max(endL, endR) + 6;
    rule();

    doc
      .font('bold')
      .fontSize(12)
      .fillColor('#111111')
      .text(t.netPay, left, doc.y, { continued: true, width });
    doc.text(`   ${money(p.netPaise)}`, { align: 'right' });
    if (p.paidAt) {
      doc.moveDown(0.3);
      doc
        .font('regular')
        .fontSize(8)
        .fillColor('#555555')
        .text(
          `${t.paidOn} ${displayDate(p.paidAt.toISOString().slice(0, 10))}${p.paymentReference ? ` · ${t.reference} ${p.paymentReference}` : ''}`,
          left,
          doc.y,
          { width },
        );
    }
    doc.moveDown(2);
    doc
      .font('regular')
      .fontSize(7)
      .fillColor('#777777')
      .text(`${t.note} ${t.englishOnly}`, left, doc.y, {
        width,
        align: 'center',
      });
    doc.text(`Schoolinkd · ${displayDate(now.toISOString().slice(0, 10))}`, {
      width,
      align: 'center',
    });
    doc.end();
  });
}
