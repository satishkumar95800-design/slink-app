import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
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
