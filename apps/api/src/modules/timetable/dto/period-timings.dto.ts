import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class PeriodTimingDto {
  @IsInt()
  @Min(1)
  @Max(20)
  periodNumber: number;

  @Matches(HH_MM, { message: 'startTime must be HH:MM (24-hour)' })
  startTime: string;

  @Matches(HH_MM, { message: 'endTime must be HH:MM (24-hour)' })
  endTime: string;
}

/** The whole bell schedule at once; periods left out are removed. */
export class ReplacePeriodTimingsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PeriodTimingDto)
  periods: PeriodTimingDto[];
}

/**
 * One bell schedule for the chosen classes, replacing whatever they had.
 * Empty periods puts those classes back on the school's schedule.
 */
export class ReplaceClassPeriodTimingsDto extends ReplacePeriodTimingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  classIds: string[];
}
