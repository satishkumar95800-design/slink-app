import { BusTripDirection } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class StartTripDto {
  @IsUUID()
  routeId: string;

  @IsEnum(BusTripDirection)
  direction: BusTripDirection;
}

/** One GPS fix from the driver's phone. */
export class PositionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  /** Metres per second. */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  speed?: number;

  @IsNumber()
  @Min(0)
  @Max(360)
  @IsOptional()
  heading?: number;

  /** Metres. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  accuracy?: number;

  /** When the phone took the fix (it may send a queued one late). */
  @IsISO8601()
  @IsOptional()
  at?: string;
}
