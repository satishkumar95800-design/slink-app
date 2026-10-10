import { IsIn } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../../common/i18n/languages';
import type { Language } from '../../../common/i18n/languages';

export class UpdateLanguageDto {
  @IsIn(SUPPORTED_LANGUAGES)
  language: Language;
}
