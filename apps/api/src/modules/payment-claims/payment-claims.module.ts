import { Module } from '@nestjs/common';
import { PaymentClaimsService } from './payment-claims.service';
import { PaymentClaimsController } from './payment-claims.controller';
import { FeesModule } from '../fees/fees.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FeesModule, NotificationsModule, FilesModule],
  controllers: [PaymentClaimsController],
  providers: [PaymentClaimsService],
})
export class PaymentClaimsModule {}
