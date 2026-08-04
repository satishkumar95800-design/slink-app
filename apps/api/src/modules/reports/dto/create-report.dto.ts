import { IsUUID, IsEnum, IsString, IsObject, Matches, MinLength, MaxLength } from 'class-validator';
import { IsOptional } from 'class-validator';
import { ReportType } from '@prisma/client';

export class CreateReportDto {
  @IsUUID()
  studentId: string;

  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType = ReportType.academic;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  term: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  academicYear: string;

  /** Free-form JSON content — grades, attendance records, remarks, etc. */
  @IsObject()
  content: Record<string, unknown>;
}
