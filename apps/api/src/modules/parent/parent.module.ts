import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [ReportsModule],
  controllers: [ParentController],
  providers: [ParentService],
})
export class ParentModule {}
