import { Module } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { StudentFeesService } from './student-fees.service';
import { FeeStructuresController } from './fee-structures.controller';
import { StudentFeesController } from './student-fees.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FeeStructuresController, StudentFeesController],
  providers: [FeeStructuresService, StudentFeesService],
  exports: [FeeStructuresService, StudentFeesService],
})
export class FeesModule {}
