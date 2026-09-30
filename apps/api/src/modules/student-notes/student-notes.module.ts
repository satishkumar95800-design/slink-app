import { Module } from '@nestjs/common';
import { StudentNotesService } from './student-notes.service';
import { StudentNotesController } from './student-notes.controller';

@Module({
  controllers: [StudentNotesController],
  providers: [StudentNotesService],
})
export class StudentNotesModule {}
