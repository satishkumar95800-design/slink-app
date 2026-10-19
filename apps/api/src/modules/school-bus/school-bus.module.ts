import { Module } from '@nestjs/common';
import { SchoolBusController } from './school-bus.controller';
import { SchoolBusService } from './school-bus.service';

/** School bus routes (flag `transport`); fee transport slabs stay in ../transport. */
@Module({
  controllers: [SchoolBusController],
  providers: [SchoolBusService],
})
export class SchoolBusModule {}
