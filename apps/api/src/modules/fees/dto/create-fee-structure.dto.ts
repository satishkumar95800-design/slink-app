import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeeItemDto } from './fee-item.dto';

export class CreateFeeStructureDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  /** One plan can span multiple classes/groups (e.g. an AS/A-Level plan spanning Groups 11 & 12) */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  classIds: string[];

  /** e.g. "2025-26" */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'academicYear must be in format YYYY-YY',
  })
  academicYear: string;

  /** ISO 8601 date string */
  @IsDateString()
  dueDate: string;

  /** Late fee charged per day after dueDate, in major currency units */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  lateFeePerDay?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FeeItemDto)
  items: FeeItemDto[];
}
