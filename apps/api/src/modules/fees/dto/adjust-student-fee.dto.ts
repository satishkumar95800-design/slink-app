import { IsEnum, IsNumber, IsString, IsOptional, Min, MinLength, MaxLength } from 'class-validator';

export enum AdjustmentType {
  DISCOUNT = 'discount',
  WAIVE = 'waive',
}

export class AdjustStudentFeeDto {
  @IsEnum(AdjustmentType)
  type: AdjustmentType;

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
