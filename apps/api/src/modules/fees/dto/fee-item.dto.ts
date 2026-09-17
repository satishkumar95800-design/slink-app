import {
  IsString,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { BillingFrequency } from '@prisma/client';

export class FeeItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  /** In major currency units (e.g. INR, not paise). Represents the ANNUAL total for this component. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(BillingFrequency)
  @IsOptional()
  billingFrequency?: BillingFrequency = BillingFrequency.one_time;

  /**
   * Only used when billingFrequency = quarterly — number of months each
   * quarter spans (must sum to 12), e.g. [3,3,2,2] for uneven school terms.
   */
  @ValidateIf((o) => o.billingFrequency === BillingFrequency.quarterly)
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @IsOptional()
  quarterMonthCounts?: number[];

  /** Marks this as the plan's transport/van fee component — a student's assigned TransportSlab then overrides the manually entered amount */
  @IsBoolean()
  @IsOptional()
  isTransportFee?: boolean = false;
}
