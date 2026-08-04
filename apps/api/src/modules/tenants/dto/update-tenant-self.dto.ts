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
} from 'class-validator';
import { Type } from 'class-transformer';

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

  /** S3 key for the tenant logo (returned by POST /files/upload with category=logo) */
  @IsString()
  @IsOptional()
  logoKey?: string;

  @ValidateNested()
  @Type(() => BrandingDto)
  @IsOptional()
  branding?: BrandingDto;
}
