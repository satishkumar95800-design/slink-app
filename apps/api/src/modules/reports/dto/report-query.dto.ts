import { IsUUID, IsEnum, IsString, IsOptional, IsInt, Matches, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType, ReportStatus } from '@prisma/client';

export class ReportQueryDto {
  @IsUUID()
  @IsOptional()
  studentId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType;

  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  academicYear?: string;

  @IsString()
  @IsOptional()
  term?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
