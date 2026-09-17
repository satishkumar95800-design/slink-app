import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTransportSlabDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  minDistanceKm?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  maxDistanceKm?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  monthlyAmount?: number;
}
