import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

/** Library (flag `library`, Premium Max). */
@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
})
export class LibraryModule {}
