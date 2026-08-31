import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @IsOptional()
  section?: string;

  /** e.g. "2025-26" */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'academicYear must be in format YYYY-YY',
  })
  academicYear: string;
}
