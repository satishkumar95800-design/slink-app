import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { ClassesService } from './classes.service';
import { StudentsController } from './students.controller';
import { ClassesController } from './classes.controller';

@Module({
  providers: [StudentsService, ClassesService],
  controllers: [StudentsController, ClassesController],
  exports: [StudentsService],
})
export class StudentsModule {}
