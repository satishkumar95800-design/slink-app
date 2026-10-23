import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ReceptionFormsController } from './reception-forms.controller';
import { ReceptionFormsService } from './reception-forms.service';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

/** Front desk for the receptionist (part of the `admissions` flag). */
@Module({
  imports: [FilesModule],
  controllers: [ReceptionController, ReceptionFormsController],
  providers: [ReceptionService, ReceptionFormsService],
})
export class ReceptionModule {}
