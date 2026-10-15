import { Prisma } from '@prisma/client';
import {
  PaymentClaimCheckService,
  normalizeReference,
} from './payment-claim-check.service';
import { AiUnavailableError } from '../ai/ai.service';

function setup(extracted: Record<string, unknown> | Error) {
  const prisma = {
    paymentClaim: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'c1',
        fileKey: 'tenants/t1/claims/proof.jpg',
        claimedAmount: new Prisma.Decimal('5000'),
        claimedDate: new Date('2026-10-10T00:00:00Z'),
      }),
    },
    paymentClaimCheck: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
    receipt: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const files = {
    getSignedUrl: jest.fn().mockResolvedValue('https://s3/proof.jpg'),
  };
  const ai = {
    isAvailable: jest.fn().mockResolvedValue(true),
    completeJson: jest.fn(() =>
      extracted instanceof Error
        ? Promise.reject(extracted)
        : Promise.resolve(extracted),
    ),
  };
  const service = new PaymentClaimCheckService(
    prisma as never,
    files as never,
    ai as never,
  );
  return { prisma, ai, service };
}

const saved = (prisma: ReturnType<typeof setup>['prisma']) =>
  (
    prisma.paymentClaimCheck.upsert.mock.calls[0] as [
      { create: { status: string; flags: string[]; reference: string | null } },
    ]
  )[0].create;

describe('PaymentClaimCheckService', () => {
  const fetchMock = jest.fn();
  beforeAll(() => {
    global.fetch = fetchMock as never;
  });
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    });
  });

  it('sends the screenshot to the model and stores a clean read', async () => {
    const { prisma, ai, service } = setup({
      is_payment_proof: true,
      amount: 5000,
      date: '2026-10-10',
      reference: '4321 9876 5555',
      payee: 'Green Valley School',
      status: 'success',
    });

    await service.run('t1', 'c1');

    const [[req]] = ai.completeJson.mock.calls as unknown as [
      [{ content: { type: string; source?: { media_type: string } }[] }],
    ];
    expect(req.content[0]).toMatchObject({
      type: 'image',
      source: { media_type: 'image/jpeg' },
    });
    expect(saved(prisma)).toMatchObject({
      status: 'done',
      reference: '4321 9876 5555',
      flags: [],
    });
  });

  it('flags a different amount, a different date and a failed payment', async () => {
    const { prisma, service } = setup({
      is_payment_proof: true,
      amount: 500,
      date: '2026-09-01',
      reference: 'ABC123456',
      status: 'failed',
    });
    await service.run('t1', 'c1');
    expect(saved(prisma).flags).toEqual([
      'payment_not_successful',
      'amount_mismatch',
      'date_mismatch',
    ]);
  });

  it('flags a reference already used on a receipt, whatever its spacing', async () => {
    const { prisma, service } = setup({
      is_payment_proof: true,
      amount: 5000,
      date: '2026-10-10',
      reference: 'UTR 4321-9876-5555',
      status: 'success',
    });
    prisma.receipt.findMany.mockResolvedValue([
      { reference: 'utr432198765555' },
    ]);
    await service.run('t1', 'c1');
    expect(saved(prisma).flags).toEqual(['reference_reused']);
  });

  it('flags something that is not a payment proof or cannot be read', async () => {
    const { prisma, service } = setup({
      is_payment_proof: false,
      amount: null,
    });
    await service.run('t1', 'c1');
    expect(saved(prisma).flags).toEqual(['not_payment_proof', 'unreadable']);
  });

  it('does nothing for schools without the premium module, and never throws', async () => {
    const off = setup({});
    off.ai.isAvailable.mockResolvedValue(false);
    await off.service.run('t1', 'c1');
    expect(off.ai.completeJson).not.toHaveBeenCalled();

    const failing = setup(new AiUnavailableError('failed'));
    await expect(failing.service.run('t1', 'c1')).resolves.toBeUndefined();
    expect(failing.prisma.paymentClaimCheck.upsert).not.toHaveBeenCalled();
  });

  it('normalizes references and ignores ones too short to compare', () => {
    expect(normalizeReference(' utr: 1234-5678 ')).toBe('UTR12345678');
    expect(normalizeReference('12-3')).toBeNull();
  });
});
