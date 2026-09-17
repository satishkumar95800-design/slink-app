import { IsUUID, IsNumber, Min } from 'class-validator';

export class FeeAllocationDto {
  @IsUUID()
  studentFeeComponentId: string;

  /** In major currency units (e.g. INR, not paise) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}
