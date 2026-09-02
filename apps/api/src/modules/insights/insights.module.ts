import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { InsightsController } from './insights.controller';
import { FeesModule } from '../fees/fees.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [FeesModule, ReceiptsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
