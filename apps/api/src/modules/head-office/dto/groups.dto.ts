import { CircularAudience } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  Matches,
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
