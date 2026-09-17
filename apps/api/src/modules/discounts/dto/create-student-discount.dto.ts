import { IsUUID, IsNumber, IsString, IsOptional, Min, Max, MaxLength } from 'class-validator';

export class CreateStudentDiscountDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  discountTypeId: string;

  /** Scope to one fee component; omit to apply across the whole plan */
  @IsUUID()
  @IsOptional()
  feeItemId?: string;

  /** Required when the discount type's kind is "percentage" */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  @IsOptional()
  percentage?: number;

  /** Required when the discount type's kind is "fixed_amount" */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  fixedAmount?: number;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
