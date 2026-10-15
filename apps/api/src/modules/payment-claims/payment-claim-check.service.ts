import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { AiService, AiUnavailableError } from '../ai/ai.service';

/** Claude reads JPEG/PNG/GIF/WebP images and PDFs. */
const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};
const MAX_BYTES = 5 * 1024 * 1024;

export type ClaimFlag =
  | 'not_payment_proof'
  | 'unreadable'
  | 'payment_not_successful'
  | 'amount_mismatch'
  | 'date_mismatch'
  | 'reference_reused';

interface Extracted {
  is_payment_proof?: boolean;
  amount?: number | null;
  date?: string | null;
  reference?: string | null;
  payee?: string | null;
  status?: 'success' | 'failed' | 'pending' | 'unknown';
}

const SYSTEM = `You read payment proofs that parents upload for school fees in India: UPI/bank app screenshots, bank receipts, cheque or cash receipts.
Reply with one JSON object only:
{"is_payment_proof": boolean, "amount": number|null, "date": "YYYY-MM-DD"|null, "reference": string|null, "payee": string|null, "status": "success"|"failed"|"pending"|"unknown"}
- amount: the amount paid in rupees as a number (no ₹ or commas).
- reference: the UPI transaction ID / UTR / RRN / cheque number / receipt number exactly as printed; null if none.
- payee: who was paid, as printed.
- status: what the proof says about the payment.
Use null for anything you cannot read clearly. Do not guess.`;

/** "UTR: 1234 5678" and "12345678" are the same reference. */
export function normalizeReference(
  ref: string | null | undefined,
): string | null {
  const n = (ref ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return n.length >= 6 ? n : null;
}

/**
 * Payment-proof reader (docs/SPEC-ai.md 1.3). Reads the parent's screenshot,
 * stores what it says, and flags what doesn't add up — a different amount or
 * date from the claim, a failed payment, or a reference already used on
 * another claim or receipt. Advisory: the accountant still decides.
 */
@Injectable()
export class PaymentClaimCheckService {
  private readonly logger = new Logger(PaymentClaimCheckService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly ai: AiService,
  ) {}

  /** Never throws: a failed check just leaves the claim without one. */
  async run(tenantId: string, claimId: string): Promise<void> {
    try {
      // Reading a screenshot needs a vision model (Anthropic); Sarvam's chat is text-only.
      if (!(await this.ai.isAvailable(tenantId, { vision: true }))) return;
      const claim = await this.prisma.paymentClaim.findUnique({
        where: { id: claimId, tenantId },
        select: {
          id: true,
          fileKey: true,
          claimedAmount: true,
          claimedDate: true,
        },
      });
      if (!claim) return;

      const file = await this.download(tenantId, claim.fileKey);
      if (!file) {
        await this.save(tenantId, claimId, {
          status: 'failed',
          flags: ['unreadable'],
        });
        return;
      }

      const extracted = await this.ai.completeJson<Extracted>({
        tenantId,
        feature: 'payment_proof',
        tier: 'fast',
        system: SYSTEM,
        maxTokens: 400,
        content: [
          {
            type: file.mediaType === 'application/pdf' ? 'document' : 'image',
            source: {
              type: 'base64',
              media_type: file.mediaType,
              data: file.data,
            },
          },
          { type: 'text', text: 'Read this payment proof.' },
        ],
      });

      const amount =
        typeof extracted.amount === 'number' && extracted.amount > 0
          ? new Prisma.Decimal(extracted.amount).toDecimalPlaces(2)
          : null;
      const paidOn =
        extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)
          ? new Date(`${extracted.date}T00:00:00.000Z`)
          : null;
      const reference = extracted.reference?.trim() || null;

      const flags = await this.flagsFor(tenantId, claimId, extracted, {
        amount,
        paidOn,
        reference,
        claimedAmount: claim.claimedAmount,
        claimedDate: claim.claimedDate,
      });
      await this.save(tenantId, claimId, {
        status: 'done',
        amount,
        paidOn,
        reference,
        payee: extracted.payee?.trim() || null,
        flags,
      });
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        this.logger.warn(`Claim ${claimId} not checked: ${err.message}`);
        return;
      }
      this.logger.error(
        `Claim ${claimId} check failed: ${(err as Error).message}`,
      );
    }
  }

  private async flagsFor(
    tenantId: string,
    claimId: string,
    extracted: Extracted,
    found: {
      amount: Prisma.Decimal | null;
      paidOn: Date | null;
      reference: string | null;
      claimedAmount: Prisma.Decimal | null;
      claimedDate: Date | null;
    },
  ): Promise<ClaimFlag[]> {
    const flags: ClaimFlag[] = [];
    if (extracted.is_payment_proof === false) flags.push('not_payment_proof');
    if (!found.amount && !found.reference) flags.push('unreadable');
    if (extracted.status === 'failed' || extracted.status === 'pending') {
      flags.push('payment_not_successful');
    }
    if (
      found.amount &&
      found.claimedAmount &&
      found.amount.sub(found.claimedAmount).abs().greaterThan(1)
    ) {
      flags.push('amount_mismatch');
    }
    if (
      found.paidOn &&
      found.claimedDate &&
      Math.abs(found.paidOn.getTime() - found.claimedDate.getTime()) >
        86_400_000
    ) {
      flags.push('date_mismatch');
    }
    const ref = normalizeReference(found.reference);
    if (ref && (await this.referenceUsedElsewhere(tenantId, claimId, ref))) {
      flags.push('reference_reused');
    }
    return flags;
  }

  /** The same UTR on another claim or an already-recorded receipt. */
  private async referenceUsedElsewhere(
    tenantId: string,
    claimId: string,
    ref: string,
  ): Promise<boolean> {
    const [checks, receipts] = await Promise.all([
      this.prisma.paymentClaimCheck.findMany({
        where: {
          tenantId,
          claimId: { not: claimId },
          reference: { not: null },
        },
        select: { reference: true },
      }),
      this.prisma.receipt.findMany({
        where: { tenantId, reference: { not: null } },
        select: { reference: true },
      }),
    ]);
    return [...checks, ...receipts].some(
      (r) => normalizeReference(r.reference) === ref,
    );
  }

  private async download(
    tenantId: string,
    key: string,
  ): Promise<{ mediaType: string; data: string } | null> {
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    const url = await this.files.getSignedUrl(key, tenantId, 300);
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const mediaType = Object.values(MEDIA_TYPES).includes(type)
      ? type
      : MEDIA_TYPES[ext];
    if (!mediaType) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return { mediaType, data: bytes.toString('base64') };
  }

  private async save(
    tenantId: string,
    claimId: string,
    data: {
      status: 'done' | 'failed';
      amount?: Prisma.Decimal | null;
      paidOn?: Date | null;
      reference?: string | null;
      payee?: string | null;
      flags: ClaimFlag[];
    },
  ) {
    const row = {
      status: data.status,
      amount: data.amount ?? null,
      paidOn: data.paidOn ?? null,
      reference: data.reference ?? null,
      payee: data.payee ?? null,
      flags: data.flags,
    };
    await this.prisma.paymentClaimCheck.upsert({
      where: { claimId },
      create: { claimId, tenantId, ...row },
      update: row,
    });
  }
}
