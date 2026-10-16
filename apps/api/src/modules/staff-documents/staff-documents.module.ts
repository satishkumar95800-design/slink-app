import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { StaffDocumentsController } from './staff-documents.controller';
import { StaffDocumentsService } from './staff-documents.service';

@Module({
  imports: [FilesModule],
  controllers: [StaffDocumentsController],
  providers: [StaffDocumentsService],
})
export class StaffDocumentsModule {}
