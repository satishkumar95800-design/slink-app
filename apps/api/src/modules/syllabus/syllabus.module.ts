import { Module } from '@nestjs/common';
import { SyllabusController } from './syllabus.controller';
import { SyllabusService } from './syllabus.service';

@Module({
  controllers: [SyllabusController],
  providers: [SyllabusService],
})
export class SyllabusModule {}
