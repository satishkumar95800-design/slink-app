import { IsString, IsOptional, Matches, MinLength, MaxLength, IsHexColor } from 'class-validator';

export class CreateTenantDto {
  /** URL-safe slug: lowercase letters, digits, hyphens. e.g. "greenfield-school" */
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. my-school)',
  })
  @MinLength(3)
  @MaxLength(63)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  /** IANA timezone, e.g. "Asia/Kolkata". Defaults to "Asia/Kolkata". */
  @IsString()
  @IsOptional()
  timezone?: string;

  @IsHexColor()
  @IsOptional()
  primaryColor?: string;

  @IsHexColor()
  @IsOptional()
  accentColor?: string;
}
