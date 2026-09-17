import { Module } from '@nestjs/common';
import { TransportSlabsService } from './transport-slabs.service';
import { TransportSlabsController } from './transport-slabs.controller';

@Module({
  controllers: [TransportSlabsController],
  providers: [TransportSlabsService],
  exports: [TransportSlabsService],
})
export class TransportModule {}
