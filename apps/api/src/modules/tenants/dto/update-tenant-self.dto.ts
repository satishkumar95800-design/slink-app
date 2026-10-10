import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  IsArray,
  MinLength,
  MaxLength,
  IsHexColor,
  ValidateNested,
  IsPhoneNumber,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SUPPORTED_LANGUAGES } from '../../../common/i18n/languages';
import type { Language } from '../../../common/i18n/languages';

export class BrandingDto {
  @IsString()
  @MaxLength(300)
  @IsOptional()
  address?: string;

  @IsPhoneNumber()
  @IsOptional()
  contactPhone?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  /** S3 keys or public URLs for cover/banner photos */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  coverPhotoUrls?: string[];
}

/** admin: update their own tenant's appearance and contact info */
export class UpdateTenantSelfDto {
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

  /** What this school calls a "Class" — e.g. Class, Grade, Standard, Group, Section, or a custom word */
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @IsOptional()
  classLabel?: string;

  /** Language for parents and teachers who haven't picked one; never overrides a user's own choice. */
  @IsIn(SUPPORTED_LANGUAGES)
  @IsOptional()
  defaultLanguage?: Language;

  /** S3 key for the tenant logo (returned by POST /files/upload with category=logo) */
  @IsString()
  @IsOptional()
  logoKey?: string;

  /** S3 key for the tenant background image (returned by POST /files/upload with category=background) */
  @IsString()
  @IsOptional()
  backgroundImageKey?: string;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}
