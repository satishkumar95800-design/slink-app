import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PaymentOrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { WebhookService } from './webhook.service';
import { PaymentsService } from './payments.service';
import { SecretsService } from '../../secrets/secrets.service';

const WEBHOOK_SECRET = 'test_webhook_secret';

function makeSignature(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function makePaymentCapturedBody(orderId = 'order_rzp123', paymentId = 'pay_rzp456') {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: paymentId,
          order_id: orderId,
          amount: 500000,
          created_at: Math.floor(Date.now() / 1000),
        },
      },
    },
  });
}

function makePaymentFailedBody(orderId = 'order_rzp123') {
  return JSON.stringify({
    event: 'payment.failed',
    payload: {
      payment: { entity: { id: 'pay_rzp_failed', order_id: orderId, amount: 500000, created_at: 0 } },
    },
  });
}

const mockOrder = {
  id: 'order-uuid',
  tenantId: 'tenant-uuid',
  studentFeeId: 'fee-uuid',
  amount: new Prisma.Decimal('5000.00'),
  status: PaymentOrderStatus.created,
};

const mockPayments = {
  findOrderByGatewayOrderId: jest.fn(),
  capturePayment: jest.fn(),
  markOrderFailed: jest.fn(),
};

const mockSecrets = {
  getRazorpayCredentials: jest.fn().mockResolvedValue({
    keyId: 'rzp_test_key',
    keySecret: 'rzp_test_secret',
    webhookSecret: WEBHOOK_SECRET,
  }),
};

describe('WebhookService', () => {
  let service: WebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: PaymentsService, useValue: mockPayments },
        { provide: SecretsService, useValue: mockSecrets },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    jest.clearAllMocks();
    mockSecrets.getRazorpayCredentials.mockResolvedValue({
      keyId: 'rzp_test_key',
      keySecret: 'rzp_test_secret',
      webhookSecret: WEBHOOK_SECRET,
    });
  });

  describe('handle - payment.captured', () => {
    it('calls capturePayment on valid signature and known order', async () => {
      const body = makePaymentCapturedBody();
      const sig = makeSignature(body);

      mockPayments.findOrderByGatewayOrderId.mockResolvedValue(mockOrder);
      mockPayments.capturePayment.mockResolvedValue(undefined);

      await service.handle(Buffer.from(body), sig);
      expect(mockPayments.capturePayment).toHaveBeenCalledTimes(1);
    });

    it('throws UnauthorizedException for invalid signature', async () => {
      const body = makePaymentCapturedBody();
      mockPayments.findOrderByGatewayOrderId.mockResolvedValue(mockOrder);

      await expect(service.handle(Buffer.from(body), 'bad_signature')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not call capturePayment when signature is wrong', async () => {
      const body = makePaymentCapturedBody();
      mockPayments.findOrderByGatewayOrderId.mockResolvedValue(mockOrder);

      await expect(service.handle(Buffer.from(body), 'wrong')).rejects.toThrow();
      expect(mockPayments.capturePayment).not.toHaveBeenCalled();
    });
  });

  describe('handle - payment.failed', () => {
    it('calls markOrderFailed on valid signature', async () => {
      const body = makePaymentFailedBody();
      const sig = makeSignature(body);

      mockPayments.findOrderByGatewayOrderId.mockResolvedValue(mockOrder);
      mockPayments.markOrderFailed.mockResolvedValue(undefined);

      await service.handle(Buffer.from(body), sig);
      expect(mockPayments.markOrderFailed).toHaveBeenCalledWith(mockOrder.id);
    });
  });

  describe('handle - unknown order', () => {
    it('acks silently when order is not found in our DB', async () => {
      const body = makePaymentCapturedBody('order_foreign');
      const sig = makeSignature(body);

      mockPayments.findOrderByGatewayOrderId.mockResolvedValue(null);

      await expect(service.handle(Buffer.from(body), sig)).resolves.toBeUndefined();
      expect(mockPayments.capturePayment).not.toHaveBeenCalled();
    });
  });

  describe('handle - unknown event', () => {
    it('acks silently for unhandled event types', async () => {
      const body = JSON.stringify({ event: 'order.paid', payload: {} });
      // No order_id extractable — should silently return
      await expect(service.handle(Buffer.from(body), 'any')).resolves.toBeUndefined();
      expect(mockPayments.capturePayment).not.toHaveBeenCalled();
    });
  });

  describe('handle - invalid body', () => {
    it('throws BadRequestException for malformed JSON', async () => {
      await expect(service.handle(Buffer.from('not-json'), 'sig')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
