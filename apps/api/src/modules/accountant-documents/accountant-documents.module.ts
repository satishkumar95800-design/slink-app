import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { DocumentCategoriesService } from './document-categories.service';
import { DocumentCategoriesController } from './document-categories.controller';
import { AccountantDocumentsService } from './accountant-documents.service';
import { AccountantDocumentsController } from './accountant-documents.controller';

@Module({
  imports: [FilesModule],
  controllers: [DocumentCategoriesController, AccountantDocumentsController],
  providers: [DocumentCategoriesService, AccountantDocumentsService],
})
export class AccountantDocumentsModule {}
