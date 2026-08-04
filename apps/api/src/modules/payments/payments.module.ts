import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { WebhookService } from './webhook.service';
import { OrdersController } from './orders.controller';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [OrdersController, WebhookController],
  providers: [PaymentsService, WebhookService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
