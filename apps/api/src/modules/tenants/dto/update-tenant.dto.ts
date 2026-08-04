import {
  IsString,
  IsOptional,
  IsBoolean,
  Matches,
  MinLength,
  MaxLength,
  IsHexColor,
} from 'class-validator';

/** super_admin: update any field on any tenant */
export class UpdateTenantDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MinLength(3)
  @MaxLength(63)
  @IsOptional()
  slug?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @IsHexColor()
  @IsOptional()
  accentColor?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
