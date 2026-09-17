import { IsNumber, Min } from 'class-validator';

export class CreateTransportSlabDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minDistanceKm: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  maxDistanceKm: number;

  /** In major currency units (e.g. INR, not paise) */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monthlyAmount: number;
}
