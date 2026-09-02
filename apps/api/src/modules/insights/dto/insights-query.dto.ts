import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsIn,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

/**
 * Shared query shape across the /insights report endpoints — each endpoint only
 * reads the fields relevant to it. Kept as one DTO since the report types share
 * most of their filters (class, date range, pagination).
 */
export class InsightsQueryDto {
  @IsUUID()
  @IsOptional()
  studentId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  academicYear?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  daysOverdue?: number;

  @IsIn(['json', 'csv'])
  @IsOptional()
  format?: 'json' | 'csv';

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
