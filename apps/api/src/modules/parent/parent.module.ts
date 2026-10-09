import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [ReportsModule, BroadcastsModule],
  controllers: [ParentController],
  providers: [ParentService],
})
export class ParentModule {}
