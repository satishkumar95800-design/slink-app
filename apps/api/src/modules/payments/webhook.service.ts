import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { SecretsService } from '../../secrets/secrets.service';
import { PaymentsService } from './payments.service';

interface RazorpayWebhookPayment {
  id: string;
  order_id: string;
  amount: number; // paise
  created_at: number; // unix timestamp
}

interface RazorpayWebhookBody {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookPayment };
    order?: { entity?: { id: string } };
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly secrets: SecretsService,
  ) {}

  async handle(rawBody: Buffer, signature: string): Promise<void> {
    // Parse body first to extract gateway order ID for tenant resolution
    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(rawBody.toString()) as RazorpayWebhookBody;
    } catch {
      throw new BadRequestException('Invalid webhook body');
    }

    const gatewayOrderId = this.extractOrderId(body);
    if (!gatewayOrderId) {
      // Event type we don't care about; ack it
      this.logger.debug(`Ignoring webhook event: ${body.event} (no order_id)`);
      return;
    }

    // Resolve tenant from the stored PaymentOrder
    const order = await this.payments.findOrderByGatewayOrderId(gatewayOrderId);
    if (!order) {
      // Order not found — may belong to another service; ack it to prevent Razorpay retries
      this.logger.warn(`Webhook received for unknown order: ${gatewayOrderId}`);
      return;
    }

    // Fetch tenant-specific webhook secret and verify HMAC (invariant #3)
    const { webhookSecret } = await this.secrets.getRazorpayCredentials(
      order.tenantId,
    );
    this.verifyHmac(rawBody, signature, webhookSecret);

    await this.processEvent(body, order);
  }

  private verifyHmac(rawBody: Buffer, signature: string, secret: string): void {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expected !== signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private extractOrderId(body: RazorpayWebhookBody): string | null {
    const payment = body.payload?.payment?.entity;
    if (payment?.order_id) return payment.order_id;

    const order = body.payload?.order?.entity;
    if (order?.id) return order.id;

    return null;
  }

  private async processEvent(
    body: RazorpayWebhookBody,
    order: { id: string; tenantId: string; studentFeeId: string; amount: any },
  ): Promise<void> {
    switch (body.event) {
      case 'payment.captured': {
        const payment = body.payload?.payment?.entity;
        if (!payment) break;
        await this.payments.capturePayment(
          order,
          payment.id,
          '', // Razorpay signature is on the whole webhook, not per-payment
          new Date(payment.created_at * 1000),
        );
        this.logger.log(
          `Payment captured: ${payment.id} for order ${order.id}`,
        );
        break;
      }

      case 'payment.failed': {
        await this.payments.markOrderFailed(order.id);
        this.logger.warn(`Payment failed for order: ${order.id}`);
        break;
      }

      default:
        this.logger.debug(`Unhandled webhook event: ${body.event}`);
    }
  }
}
