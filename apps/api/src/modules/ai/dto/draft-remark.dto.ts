import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SUPPORTED_LANGUAGES } from '../../../common/i18n/languages';

export class DraftRemarkDto {
  @IsUUID()
  studentId: string;

  /** The teacher's own notes to build on, e.g. "good at maths, talks in class". */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  points?: string;

  /** Defaults to the teacher's language. */
  @IsIn(SUPPORTED_LANGUAGES)
  @IsOptional()
  language?: string;
}
