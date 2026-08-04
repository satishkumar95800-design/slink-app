import { IsString, MinLength, MaxLength, IsNumber, Min } from 'class-validator';

export class FeeItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  /** In major currency units (e.g. INR, not paise) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}
