import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { TranslationService } from './translation.service';
import { RemarksService } from './remarks.service';
import { AiController } from './ai.controller';

/** Shared AI client and helpers (docs/SPEC-ai.md); any module can inject them. */
@Global()
@Module({
  controllers: [AiController],
  providers: [AiService, TranslationService, RemarksService],
  exports: [AiService, TranslationService],
})
export class AiModule {}
