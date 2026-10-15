import { SchoolEventType } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CalendarQueryDto {
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to: string;
}

export class EventQueryDto {
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @IsOptional()
  to?: string;
}

export class CreateEventDto {
  @IsEnum(SchoolEventType)
  type: SchoolEventType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @Matches(DATE_PATTERN, { message: 'startDate must be YYYY-MM-DD' })
  startDate: string;

  @Matches(DATE_PATTERN, { message: 'endDate must be YYYY-MM-DD' })
  @IsOptional()
  endDate?: string;

  /** HH:mm, 24-hour. */
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:mm' })
  @IsOptional()
  startTime?: string;

  @Matches(TIME_PATTERN, { message: 'endTime must be HH:mm' })
  @IsOptional()
  endTime?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  venue?: string;
}
