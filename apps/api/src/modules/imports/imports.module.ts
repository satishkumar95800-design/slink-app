import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ImportsProcessor } from './imports.processor';
import { WorkbookParserService } from './workbook-parser.service';
import { TemplateGeneratorService } from './template-generator.service';
import { ImportCleanupService } from './import-cleanup.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'imports' })],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ImportsProcessor,
    WorkbookParserService,
    TemplateGeneratorService,
    ImportCleanupService,
  ],
})
export class ImportsModule {}
