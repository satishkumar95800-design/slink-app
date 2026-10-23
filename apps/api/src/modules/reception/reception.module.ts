import { Module } from '@nestjs/common';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

/** Front desk for the receptionist (part of the `admissions` flag). */
@Module({
  controllers: [ReceptionController],
  providers: [ReceptionService],
})
export class ReceptionModule {}
