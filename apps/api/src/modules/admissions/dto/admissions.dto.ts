import { AdmissionSource, AdmissionStage } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9+\-\s()]{6,20}$/;
const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateEnquiryDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  childName: string;

  @Matches(DATE, { message: 'dob must be YYYY-MM-DD' })
  @IsOptional()
  dob?: string;

  @trim()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  classSought?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  parentName: string;

  @Matches(PHONE, { message: 'phone looks invalid' })
  phone: string;

  @trim()
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(AdmissionSource)
  source: AdmissionSource;

  @Matches(DATE, { message: 'nextFollowUpOn must be YYYY-MM-DD' })
  @IsOptional()
  nextFollowUpOn?: string;

  @trim()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;
}

/** Everything but the stage; null clears an optional field. */
export class UpdateEnquiryDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  childName?: string;

  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'dob must be YYYY-MM-DD' })
  @IsOptional()
  dob?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @trim()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  classSought?: string | null;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  parentName?: string;

  @Matches(PHONE, { message: 'phone looks invalid' })
  @IsOptional()
  phone?: string;

  @ValidateIf((_o, v) => v !== null)
  @trim()
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsEnum(AdmissionSource)
  @IsOptional()
  source?: AdmissionSource;

  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'tourOn must be YYYY-MM-DD' })
  @IsOptional()
  tourOn?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'nextFollowUpOn must be YYYY-MM-DD' })
  @IsOptional()
  nextFollowUpOn?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @trim()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  @IsOptional()
  assignedTo?: string | null;
}

export class MoveStageDto {
  @IsEnum(AdmissionStage)
  stage: AdmissionStage;

  /** Required when moving to `lost`. */
  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  lostReason?: string;

  @trim()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}

export class NoteDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note: string;
}

export class EnquiryQueryDto {
  @IsEnum(AdmissionStage)
  @IsOptional()
  stage?: AdmissionStage;

  /** Follow-ups due today, or overdue (before today). */
  @IsIn(['today', 'overdue'])
  @IsOptional()
  due?: 'today' | 'overdue';

  /** Enquiries made today (school-local day): the front desk's count. */
  @IsIn(['today'])
  @IsOptional()
  created?: 'today';

  @IsString()
  @MaxLength(100)
  @IsOptional()
  q?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
