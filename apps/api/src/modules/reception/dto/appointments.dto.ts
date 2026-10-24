import { AppointmentKind, AppointmentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AppointmentDto {
  @IsEnum(AppointmentKind)
  kind: AppointmentKind;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @trim()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  /** Who they are meeting ("Principal", "Mrs Rao"). */
  @trim()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  withWhom?: string;

  @Matches(YMD, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @Matches(HHMM, { message: 'time must be HH:MM' })
  time: string;

  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}

export class UpdateAppointmentDto {
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @Matches(YMD, { message: 'date must be YYYY-MM-DD' })
  @IsOptional()
  date?: string;

  @Matches(HHMM, { message: 'time must be HH:MM' })
  @IsOptional()
  time?: string;

  @trim()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  withWhom?: string;

  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}

export class AppointmentRangeDto {
  @Matches(YMD, { message: 'from must be YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @Matches(YMD, { message: 'to must be YYYY-MM-DD' })
  @IsOptional()
  to?: string;
}
