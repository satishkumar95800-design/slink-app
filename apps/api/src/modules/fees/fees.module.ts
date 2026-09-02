import { Module } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { StudentFeesService } from './student-fees.service';
import { FeeStructuresController } from './fee-structures.controller';
import { StudentFeesController } from './student-fees.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [NotificationsModule, ReceiptsModule],
  controllers: [FeeStructuresController, StudentFeesController],
  providers: [FeeStructuresService, StudentFeesService],
  exports: [FeeStructuresService, StudentFeesService],
})
export class FeesModule {}
