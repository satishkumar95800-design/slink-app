import { BadRequestException } from '@nestjs/common';
import { PaymentGatewayService } from './payment-gateway.service';

const ordersAll = jest.fn();
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({ orders: { all: ordersAll } })),
);

const KEY = 'a-test-encryption-key-that-is-long-enough';

function makeService(secretKey: string = KEY) {
  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue({ id: 't1' }) },
    tenantPaymentGateway: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockReturnValue(secretKey) };
  return {
    prisma,
    service: new PaymentGatewayService(prisma as never, config as never),
  };
}

const dto = {
  keyId: 'rzp_test_abc123',
  keySecret: 'secret-12345',
  webhookSecret: 'whsec-12345',
};

describe('PaymentGatewayService', () => {
  beforeEach(() => ordersAll.mockReset().mockResolvedValue({ items: [] }));

  it('stores the secrets encrypted and reads them back', async () => {
    const { prisma, service } = makeService();
    await service.set('t1', dto);

    const [[upsertArgs]] = prisma.tenantPaymentGateway.upsert.mock.calls as [
      [
        {
          create: {
            keyId: string;
            keySecretEnc: string;
            webhookSecretEnc: string;
          };
        },
      ],
    ];
    const saved = upsertArgs.create;
    expect(saved.keyId).toBe('rzp_test_abc123');
    expect(saved.keySecretEnc).not.toContain('secret-12345');
    expect(saved.webhookSecretEnc).not.toContain('whsec-12345');

    prisma.tenantPaymentGateway.findUnique.mockResolvedValue(saved);
    expect(await service.findCredentials('t1')).toEqual({
      keyId: 'rzp_test_abc123',
      keySecret: 'secret-12345',
      webhookSecret: 'whsec-12345',
    });
  });

  it('encrypts the same secret differently each time', () => {
    const { service } = makeService();
    expect(service.encrypt('x')).not.toEqual(service.encrypt('x'));
  });

  it('treats keys encrypted with another server key as not set up', async () => {
    const { service } = makeService();
    const stored = service.encrypt('secret');
    const other = makeService('a-completely-different-key-also-long-enough');
    other.prisma.tenantPaymentGateway.findUnique.mockResolvedValue({
      keyId: 'rzp_test_x',
      keySecretEnc: stored,
      webhookSecretEnc: stored,
    });
    expect(await other.service.findCredentials('t1')).toBeNull();
  });

  it('refuses keys Razorpay rejects, and saves nothing', async () => {
    const { prisma, service } = makeService();
    ordersAll.mockRejectedValue({ statusCode: 401 });
    await expect(service.set('t1', dto)).rejects.toThrow(
      'Razorpay rejected these keys',
    );
    expect(prisma.tenantPaymentGateway.upsert).not.toHaveBeenCalled();
  });

  it('refuses to store keys when the server has no encryption key', async () => {
    const { prisma, service } = makeService('');
    await expect(service.set('t1', dto)).rejects.toThrow(BadRequestException);
    expect(ordersAll).not.toHaveBeenCalled();
    expect(prisma.tenantPaymentGateway.upsert).not.toHaveBeenCalled();
  });

  it('reports test or live mode without exposing secrets', async () => {
    const { prisma, service } = makeService();
    prisma.tenantPaymentGateway.findUnique.mockResolvedValue({
      keyId: 'rzp_live_abc',
      updatedAt: new Date('2026-10-16'),
    });
    expect(await service.status('t1')).toEqual({
      configured: true,
      keyId: 'rzp_live_abc',
      mode: 'live',
      updatedAt: new Date('2026-10-16'),
    });
  });
});
