import { IsEnum, IsString, IsObject, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ReportType } from '@prisma/client';

export class UpdateReportDto {
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @IsOptional()
  term?: string;

  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;
}
