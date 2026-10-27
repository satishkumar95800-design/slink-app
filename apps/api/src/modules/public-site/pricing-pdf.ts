import { join } from 'path';
import PDFDocument from 'pdfkit';
import { formatDateOnly, formatRupees } from '../../common/format';
import { groupQuote } from '../../common/subscription';
import {
  ADD_ONS,
  COMPARISON,
  CONTACT_LINE,
  FRANCHISE_PRICING,
  GST_RATE,
  type Cell,
  PLANS,
  PRICING_YEAR,
  TERMS,
} from './pricing-plans';

/** Noto Sans from the fee receipt: it has the rupee sign Helvetica lacks. */
const FONT_DIR = join(__dirname, '..', 'receipts', 'fonts');
const REGULAR = join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = join(FONT_DIR, 'NotoSans-Bold.ttf');

const TEAL = '#123E3B';
const CORAL = '#E8623D';
const GOLD = '#9A6A12';
const INK = '#15302C';
const MUTED = '#5B6F6B';
const LINE = '#DBE4E1';
const TINT = '#E3F1EE';

const M = 40;

/** The Schoolinkd plans and pricing sheet, personalised with the school's name. */
export function buildPricingPdf(
  schoolName: string,
  now: Date = new Date(),
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: M,
      bufferPages: true,
      info: {
        Title: `Schoolinkd Plans and Pricing ${PRICING_YEAR}`,
        Author: 'Schoolinkd',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('regular', REGULAR);
    doc.registerFont('bold', BOLD);

    const pageW = doc.page.width;
    const width = pageW - M * 2;
    const bottom = () => doc.page.height - M - 20;

    // Header band
    doc.rect(0, 0, pageW, 96).fill(TEAL);
    doc
      .font('bold')
      .fontSize(24)
      .fillColor('#FFFFFF')
      .text('Schoolinkd', M, 26, { width });
    doc
      .font('regular')
      .fontSize(11)
      .fillColor('#F6C9B9')
      .text(`Plans and pricing · academic year ${PRICING_YEAR}`, M, 58, {
        width,
      });
    doc
      .font('regular')
      .fontSize(9)
      .fillColor('#FFFFFF')
      .text('schoolinkd.in', M, 34, { width, align: 'right' });

    doc.y = 114;
    doc
      .font('regular')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(
        `Prepared for ${schoolName} on ${formatDateOnly(now)}. Three yearly plans, each a flat school price with a student allowance. Prices exclude 18% GST.`,
        M,
        doc.y,
        { width },
      );
    doc.moveDown(1.2);

    // Plan cards
    const gap = 12;
    const cardW = (width - gap * 2) / 3;
    const pad = 12;
    const inner = cardW - pad * 2;
    const top = doc.y;
    const heights = PLANS.map((p) => {
      doc.font('regular').fontSize(8.5);
      const list = p.highlights.reduce(
        (h, item) => h + doc.heightOfString(item, { width: inner - 10 }) + 3,
        0,
      );
      doc.font('regular').fontSize(8);
      return 166 + doc.heightOfString(p.tagline, { width: inner }) + list;
    });
    const cardH = Math.max(...heights);
    PLANS.forEach((p, i) => {
      const x = M + i * (cardW + gap);
      const accent = i === 2 ? GOLD : i === 1 ? CORAL : TEAL;
      doc
        .roundedRect(x, top, cardW, cardH, 8)
        .lineWidth(i === 0 ? 0.8 : 1.6)
        .strokeColor(i === 0 ? LINE : accent)
        .stroke();
      let y = top + pad;
      doc
        .font('bold')
        .fontSize(14)
        .fillColor(accent)
        .text(p.name, x + pad, y, { width: inner });
      y = doc.y + 1;
      doc
        .font('regular')
        .fontSize(8)
        .fillColor(MUTED)
        .text(p.tagline, x + pad, y, { width: inner });
      y = doc.y + 8;
      // List price struck through, and the saving.
      const was = formatRupees(p.listPrice);
      doc.font('regular').fontSize(9.5).fillColor(MUTED);
      const wasW = doc.widthOfString(was);
      doc.text(was, x + pad, y, { lineBreak: false });
      doc
        .moveTo(x + pad, y + 5.5)
        .lineTo(x + pad + wasW, y + 5.5)
        .lineWidth(0.8)
        .strokeColor(MUTED)
        .stroke();
      doc
        .font('bold')
        .fontSize(8.5)
        .fillColor(CORAL)
        .text(
          `Save ${formatRupees(p.listPrice - p.price)}`,
          x + pad + wasW + 8,
          y + 0.5,
          { lineBreak: false },
        );
      y += 14;
      doc
        .font('bold')
        .fontSize(20)
        .fillColor(INK)
        .text(formatRupees(p.price), x + pad, y, { width: inner });
      y = doc.y;
      doc
        .font('regular')
        .fontSize(8)
        .fillColor(MUTED)
        .text('per year, plus GST', x + pad, y, { width: inner });
      doc.text(
        `${formatRupees(Math.round(p.price * (1 + GST_RATE)))} with GST`,
        x + pad,
        doc.y,
        { width: inner },
      );
      y = doc.y + 6;
      doc
        .font('bold')
        .fontSize(8.5)
        .fillColor(INK)
        .text(
          `Up to ${p.students.toLocaleString('en-IN')} students`,
          x + pad,
          y,
          { width: inner },
        );
      doc
        .font('regular')
        .fontSize(8)
        .fillColor(MUTED)
        .text(
          `${formatRupees(p.extraStudent)} a year per extra student`,
          x + pad,
          doc.y,
          { width: inner },
        );
      y = doc.y + 6;
      doc
        .moveTo(x + pad, y)
        .lineTo(x + cardW - pad, y)
        .lineWidth(0.5)
        .strokeColor(LINE)
        .stroke();
      y += 7;
      for (const item of p.highlights) {
        tick(doc, x + pad, y + 2.5, accent);
        doc
          .font(item.startsWith('Everything') ? 'bold' : 'regular')
          .fontSize(8.5)
          .fillColor(INK)
          .text(item, x + pad + 10, y, { width: inner - 10 });
        y = doc.y + 3;
      }
    });
    doc.y = top + cardH + 18;

    // Add-ons and terms
    sectionTitle(doc, 'Add-ons for Premium', width);
    for (const [name, price] of ADD_ONS) {
      row2(doc, name, `${formatRupees(price)} / year`, width);
    }
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `Taking both add-ons costs more than Premium Max at ${formatRupees(PLANS[2].price)}.`,
        M,
        doc.y + 2,
        { width },
      );
    doc.moveDown(1);
    sectionTitle(doc, 'Terms', width);
    for (const term of TERMS) {
      const y = doc.y;
      doc.circle(M + 3, y + 5.5, 1.4).fill(TEAL);
      doc
        .font('regular')
        .fontSize(8.5)
        .fillColor(INK)
        .text(term, M + 10, y, { width: width - 10 });
      doc.y += 2;
    }

    const contact = () => {
      const cy = doc.y;
      doc.roundedRect(M, cy, width, 40, 6).fill(TINT);
      doc
        .font('bold')
        .fontSize(10)
        .fillColor(TEAL)
        .text(CONTACT_LINE, M, cy + 14, { width, align: 'center' });
    };
    // On page 1 when it fits, else under the comparison table (never a page
    // of its own).
    doc.moveDown(1.2);
    const contactOnFirstPage = doc.y + 50 <= bottom();
    if (contactOnFirstPage) contact();

    // Comparison table
    doc.addPage();
    sectionTitle(doc, 'What each plan includes', width);
    const featW = width - 3 * 82;
    const colW = 82;
    const header = () => {
      const y = doc.y;
      doc.rect(M, y, width, 22).fill(TEAL);
      doc
        .font('bold')
        .fontSize(9)
        .fillColor('#FFFFFF')
        .text('Feature', M + 8, y + 6, { width: featW - 8 });
      PLANS.forEach((p, i) =>
        doc.text(p.name, M + featW + i * colW, y + 6, {
          width: colW,
          align: 'center',
        }),
      );
      doc.y = y + 22;
    };
    header();
    for (const group of COMPARISON) {
      if (doc.y + 40 > bottom()) {
        doc.addPage();
        header();
      }
      const gy = doc.y;
      doc.rect(M, gy, width, 18).fill(TINT);
      doc
        .font('bold')
        .fontSize(8)
        .fillColor(TEAL)
        .text(group.title.toUpperCase(), M + 8, gy + 5, {
          width: featW,
          characterSpacing: 0.6,
        });
      doc.y = gy + 18;
      for (const [label, ...cells] of group.rows) {
        doc.font('regular').fontSize(8.5);
        const h = Math.max(
          18,
          doc.heightOfString(label, { width: featW - 16 }) + 8,
        );
        if (doc.y + h > bottom()) {
          doc.addPage();
          header();
        }
        const y = doc.y;
        doc
          .font('regular')
          .fontSize(8.5)
          .fillColor(INK)
          .text(label, M + 8, y + 4.5, { width: featW - 16 });
        cells.forEach((cell, i) =>
          drawCell(doc, cell, M + featW + i * colW, y, colW, h),
        );
        doc
          .moveTo(M, y + h)
          .lineTo(M + width, y + h)
          .lineWidth(0.4)
          .strokeColor(LINE)
          .stroke();
        doc.y = y + h;
      }
    }
    if (!contactOnFirstPage) {
      doc.y += 18;
      if (doc.y + 50 > bottom()) doc.addPage();
      contact();
    }

    // Schools with several branches (docs/SPEC-franchise.md §5)
    doc.addPage();
    sectionTitle(doc, 'Schools with several branches', width);
    doc
      .font('regular')
      .fontSize(9.5)
      .fillColor(MUTED)
      .text(
        `For groups and franchises of ${FRANCHISE_PRICING.minBranches} or more schools. Every branch gets the Premium features and pays by its size, with a discount for the number of branches. A head office login sees all branches side by side and can send circulars to them.`,
        M,
        doc.y,
        { width },
      );
    doc.moveDown(1);
    sectionTitle(doc, 'Price per branch, per year', width);
    for (const band of FRANCHISE_PRICING.bands)
      row2(doc, band.label, formatRupees(band.price), width);
    row2(
      doc,
      `More than ${FRANCHISE_PRICING.bands[FRANCHISE_PRICING.bands.length - 1].upTo.toLocaleString('en-IN')} students`,
      `+ ${formatRupees(FRANCHISE_PRICING.extraStudent)} per extra student`,
      width,
    );
    row2(
      doc,
      'Premium Max features (HR, payroll and AI) for a branch',
      `+ ${formatRupees(FRANCHISE_PRICING.premiumMaxAddOn)}`,
      width,
    );
    doc.moveDown(0.8);
    sectionTitle(doc, 'Volume discount on branch prices', width);
    for (const d of [...FRANCHISE_PRICING.discounts].reverse()) {
      const upper = [...FRANCHISE_PRICING.discounts]
        .filter((x) => x.minBranches > d.minBranches)
        .sort((a, b) => a.minBranches - b.minBranches)[0];
      row2(
        doc,
        upper
          ? `${d.minBranches} to ${upper.minBranches - 1} branches`
          : `${d.minBranches} or more branches`,
        `${d.percent}% off`,
        width,
      );
    }
    doc.moveDown(0.8);
    sectionTitle(doc, 'Head office', width);
    row2(
      doc,
      `Head office access, below ${FRANCHISE_PRICING.headOffice.freeFromBranches} branches`,
      `${formatRupees(FRANCHISE_PRICING.headOffice.price)} / year`,
      width,
    );
    row2(
      doc,
      `${FRANCHISE_PRICING.headOffice.freeFromBranches} or more branches`,
      'Included',
      width,
    );
    for (const item of [
      'All branches compared: students, attendance, fees collected and due, parent app use, syllabus and admissions',
      'Alerts when a branch has not marked attendance by the morning cutoff',
      'Circulars to staff, and optionally parents, of all or chosen branches',
      'Read-only: branch data stays with each school',
    ]) {
      const y = doc.y;
      doc.circle(M + 3, y + 5.5, 1.4).fill(TEAL);
      doc
        .font('regular')
        .fontSize(8.5)
        .fillColor(INK)
        .text(item, M + 10, y, { width: width - 10 });
      doc.y += 2;
    }
    doc.moveDown(1);
    const example = groupQuote(
      Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: '',
        plan: 'premium' as const,
        students: 100,
      })),
    );
    const ey = doc.y;
    doc.roundedRect(M, ey, width, 54, 6).fill(TINT);
    doc
      .font('bold')
      .fontSize(10)
      .fillColor(TEAL)
      .text(
        `Example: 12 preschools of 100 children each = ${formatRupees(example.total)} a year`,
        M + 12,
        ey + 10,
        { width: width - 24 },
      );
    doc
      .font('regular')
      .fontSize(8.5)
      .fillColor(INK)
      .text(
        `12 × ${formatRupees(FRANCHISE_PRICING.bands[0].price)} less ${example.discountPercent}%, head office included: about ${formatRupees(Math.round(example.total / 1200))} per child per year, plus GST. Groups of 1 or 2 schools pay the single-school prices above.`,
        M + 12,
        ey + 27,
        { width: width - 24 },
      );

    // Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Writing inside the bottom margin would otherwise start a new page.
      doc.page.margins.bottom = 0;
      doc
        .font('regular')
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `Schoolinkd plans and pricing ${PRICING_YEAR} · page ${i + 1} of ${range.count}`,
          M,
          doc.page.height - M,
          { width, align: 'center', lineBreak: false },
        );
    }
    doc.end();
  });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, width: number) {
  doc
    .font('bold')
    .fontSize(12)
    .fillColor(TEAL)
    .text(title, M, doc.y, { width });
  doc.moveDown(0.4);
}

function row2(
  doc: PDFKit.PDFDocument,
  left: string,
  right: string,
  width: number,
) {
  const y = doc.y;
  doc
    .font('regular')
    .fontSize(9)
    .fillColor(INK)
    .text(left, M, y, { width: width - 120 });
  doc.font('bold').text(right, M + width - 120, y, {
    width: 120,
    align: 'right',
  });
  doc.y = Math.max(doc.y, y + 14);
}

/** A small drawn tick (Noto Sans has no check-mark glyph). */
function tick(doc: PDFKit.PDFDocument, x: number, y: number, color: string) {
  doc
    .moveTo(x, y + 3)
    .lineTo(x + 2.5, y + 5.5)
    .lineTo(x + 7, y)
    .lineWidth(1.3)
    .strokeColor(color)
    .stroke();
}

function drawCell(
  doc: PDFKit.PDFDocument,
  cell: Cell,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (cell === true) {
    tick(doc, x + w / 2 - 3.5, y + h / 2 - 3, TEAL);
  } else if (cell === false) {
    doc
      .moveTo(x + w / 2 - 4, y + h / 2)
      .lineTo(x + w / 2 + 4, y + h / 2)
      .lineWidth(0.8)
      .strokeColor('#A9B6B3')
      .stroke();
  } else {
    doc
      .font('regular')
      .fontSize(8)
      .fillColor(INK)
      .text(cell, x + 2, y + 5, { width: w - 4, align: 'center' });
  }
}
