import { Module } from '@nestjs/common';
import { FeeConcessionsService } from './fee-concessions.service';
import { FeeConcessionsController } from './fee-concessions.controller';

@Module({
  providers: [FeeConcessionsService],
  controllers: [FeeConcessionsController],
})
export class FeeConcessionsModule {}
