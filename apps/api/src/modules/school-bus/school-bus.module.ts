import { Module } from '@nestjs/common';
import { BusTrackingController } from './bus-tracking.controller';
import { BusTrackingService } from './bus-tracking.service';
import { SchoolBusController } from './school-bus.controller';
import { SchoolBusService } from './school-bus.service';

/** School bus routes (flag `transport`); fee transport slabs stay in ../transport. */
@Module({
  controllers: [SchoolBusController, BusTrackingController],
  providers: [SchoolBusService, BusTrackingService],
  exports: [BusTrackingService],
})
export class SchoolBusModule {}
