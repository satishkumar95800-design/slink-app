import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeeStatus } from '@prisma/client';

export class StudentFeeQueryDto {
  @IsUUID()
  @IsOptional()
  studentId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsEnum(FeeStatus)
  @IsOptional()
  status?: FeeStatus;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  academicYear?: string;

  /** Return fees with dueDate on or before this date (ISO 8601) */
  @IsDateString()
  @IsOptional()
  dueBefore?: string;

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
