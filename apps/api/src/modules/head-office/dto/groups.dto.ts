import { CircularAudience, RoyaltyMode } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  Matches,
  Max,
  Min,
  ValidateIf,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class GroupNameDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;
}

export class GroupSchoolsDto {
  /** The complete list of schools in the group. */
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  tenantIds: string[];
}

export class HeadOfficeUserDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

export class PasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

export class GroupSettingsDto {
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  /** HH:MM; attendance not marked by then is flagged to the head office. */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'attendanceCutoff must be HH:MM',
  })
  @IsOptional()
  attendanceCutoff?: string;
}

export class CreateCircularDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body: string;

  @IsEnum(CircularAudience)
  audience: CircularAudience;

  /** Chosen branches; omitted or empty = every branch that can receive it. */
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  @IsOptional()
  tenantIds?: string[];
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_AMOUNT = 1_00_00_000;

/** What a branch pays the group from a month on (a new row; earlier terms stay). */
export class RoyaltyTermsDto {
  @IsEnum(RoyaltyMode)
  mode: RoyaltyMode;

  /** percent mode: share of the fees the branch collects, e.g. 10 or 7.5. */
  @ValidateIf((o: RoyaltyTermsDto) => o.mode === RoyaltyMode.percent)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percent?: number;

  /** fixed mode: rupees every month. */
  @ValidateIf((o: RoyaltyTermsDto) => o.mode === RoyaltyMode.fixed)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  fixedAmount?: number;

  /** percent mode, optional: never less than this many rupees a month. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  minimumAmount?: number;

  @Matches(MONTH, { message: 'effectiveFrom must be YYYY-MM' })
  effectiveFrom: string;
}

export class RoyaltyPaymentDto {
  @Matches(MONTH, { message: 'month must be YYYY-MM' })
  month: string;

  /** Rupees, at most two decimals. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'receivedOn must be YYYY-MM-DD' })
  receivedOn: string;

  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @trim()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class VoidRoyaltyPaymentDto {
  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason: string;
}
