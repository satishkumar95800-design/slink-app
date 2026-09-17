import {
  IsEnum,
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum AdjustmentType {
  DISCOUNT = 'discount',
  WAIVE = 'waive',
}

export class AdjustStudentFeeDto {
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

  /** Scope the adjustment to a single fee component; omit to apply across the whole fee */
  @IsUUID()
  @IsOptional()
  studentFeeComponentId?: string;

  /** Required when type = 'discount' */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
