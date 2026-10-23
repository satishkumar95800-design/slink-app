import {
  CallDirection,
  DeskPaymentMode,
  FollowUpKind,
  VisitorPurpose,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
} from 'class-validator';
import { DESK_PAYMENT_PURPOSES } from '../reception.constants';

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const emptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : typeof value === 'string' ? value.trim() : value,
  );
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\+?[0-9 ()-]{6,20}$/;

export class FollowUpInputDto {
  @Matches(YMD)
  dueOn: string;

  @IsEnum(FollowUpKind)
  kind: FollowUpKind;

  @emptyToUndefined()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class FollowUpDoneDto {
  @emptyToUndefined()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  outcome?: string;
}

export class DocumentDto {
  @IsBoolean()
  received: boolean;

  @emptyToUndefined()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

export class DeskPaymentDto {
  @IsIn(DESK_PAYMENT_PURPOSES)
  purpose: (typeof DESK_PAYMENT_PURPOSES)[number];

  /** Rupees, e.g. "500" or "500.00". */
  @Matches(/^\d{1,7}(\.\d{1,2})?$/)
  amount: string;

  @IsEnum(DeskPaymentMode)
  mode: DeskPaymentMode;

  @emptyToUndefined()
  @IsString()
  @MaxLength(60)
  @IsOptional()
  reference?: string;

  @Matches(YMD)
  @IsOptional()
  receivedOn?: string;
}

export class VoidDto {
  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason: string;
}

export class VisitorDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @emptyToUndefined()
  @Matches(PHONE)
  @IsOptional()
  phone?: string;

  @IsEnum(VisitorPurpose)
  purpose: VisitorPurpose;

  @emptyToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  whomToMeet?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  people?: number;

  @emptyToUndefined()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}

export class CallDto {
  @IsEnum(CallDirection)
  direction: CallDirection;

  @emptyToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @trim()
  @Matches(PHONE)
  phone: string;

  @IsUUID()
  @IsOptional()
  enquiryId?: string;

  @emptyToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  purpose?: string;

  @emptyToUndefined()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class DayQueryDto {
  @Matches(YMD)
  @IsOptional()
  date?: string;
}

export class PaymentsQueryDto {
  @Matches(YMD)
  @IsOptional()
  from?: string;

  @Matches(YMD)
  @IsOptional()
  to?: string;
}
