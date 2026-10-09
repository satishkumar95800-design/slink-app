import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CleanName } from '../../../common/decorators/clean-name.decorator';

/** "98765 43210", "+91-98765-43210", "098765 43210" → "+919876543210"; anything else is left for the validator to reject. */
export function normalizeIndianMobile(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/[^\d]/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : value;
}

export class ContactRequestDto {
  @CleanName()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @CleanName()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  schoolName: string;

  @CleanName()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20000)
  studentCount: number;

  /** Indian mobile number (10 digits starting 6–9, optional +91/0 prefix). Stored as +91XXXXXXXXXX. */
  @Transform(({ value }) => normalizeIndianMobile(value))
  @Matches(/^\+91[6-9]\d{9}$/, {
    message: 'Enter a valid 10-digit Indian mobile number',
  })
  phone: string;

  @IsString()
  @MaxLength(60)
  @IsOptional()
  preferredTime?: string;

  /** Honeypot: hidden from people, filled in by bots. Must be empty. */
  @IsString()
  @MaxLength(200)
  @IsOptional()
  website?: string;
}

export const SITE_EVENTS = [
  'page_view',
  'whatsapp_click',
  'demo_click',
  'login_click',
  'video_play',
  'contact_submit',
  'store_click',
] as const;

export class SiteEventDto {
  @IsIn(SITE_EVENTS)
  event: (typeof SITE_EVENTS)[number];

  @IsString()
  @MaxLength(200)
  @IsOptional()
  path?: string;
}

export class SiteStatsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  days?: number = 30;
}
