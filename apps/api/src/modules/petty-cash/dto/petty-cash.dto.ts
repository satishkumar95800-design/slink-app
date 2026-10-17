import {
  PettyCashEntryType,
  PettyCashPayeeType,
  PettyCashStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** NUMERIC(12,2) ceiling, kept well inside it. */
export const MAX_AMOUNT = 9_999_999.99;
const PHONE_PATTERN = /^[0-9+\-\s()]{6,20}$/;

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateEntryDto {
  @IsEnum(PettyCashEntryType)
  type: PettyCashEntryType;

  /** Rupees, at most two decimals. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount: number;

  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  /** Key returned by POST /petty-cash/receipts. */
  @IsString()
  @MaxLength(300)
  @IsOptional()
  receiptKey?: string;

  @IsUUID()
  @IsOptional()
  recipientUserId?: string;

  @IsUUID()
  @IsOptional()
  payeeId?: string;

  /** The DISBURSEMENT an EXPENSE or RETURN settles. */
  @IsUUID()
  @IsOptional()
  settlesEntryId?: string;

  /**
   * Notes and coins moved, when the school tracks them:
   * { in: { "100": 1 }, out: { "500": 1 } } (rupee value -> count).
   * Checked in the service (petty-cash.denominations.ts).
   */
  @IsObject()
  @IsOptional()
  denominations?: { in?: Record<string, number>; out?: Record<string, number> };
}

export class CashCountDto {
  /** { "500": 3, "100": 7 }: rupee value -> number of notes or coins. */
  @IsObject()
  counts: Record<string, number>;

  @trim()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}

export class EntryQueryDto {
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @IsOptional()
  to?: string;

  @IsEnum(PettyCashEntryType)
  @IsOptional()
  type?: PettyCashEntryType;

  @IsEnum(PettyCashStatus)
  @IsOptional()
  status?: PettyCashStatus;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  recipientUserId?: string;

  @IsUUID()
  @IsOptional()
  payeeId?: string;

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

export class ReasonDto {
  @trim()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class StatementQueryDto {
  @IsUUID()
  @IsOptional()
  recipientUserId?: string;

  @IsUUID()
  @IsOptional()
  payeeId?: string;
}

export class AdvanceQueryDto {
  /** open (default) = still unsettled; overdue; all. */
  @IsIn(['open', 'overdue', 'all'])
  @IsOptional()
  status?: 'open' | 'overdue' | 'all';

  @IsUUID()
  @IsOptional()
  recipientUserId?: string;

  @IsUUID()
  @IsOptional()
  payeeId?: string;
}

export class CreateCategoryDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  monthlyBudget?: number;
}

export class UpdateCategoryDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @IsOptional()
  name?: string;

  /** null clears the budget. */
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  monthlyBudget?: number | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CategoryQueryDto {
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}

export class CreatePayeeDto {
  @IsEnum(PettyCashPayeeType)
  type: PettyCashPayeeType;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @Matches(PHONE_PATTERN, { message: 'phone looks invalid' })
  @IsOptional()
  phone?: string;

  @trim()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class UpdatePayeeDto {
  @IsEnum(PettyCashPayeeType)
  @IsOptional()
  type?: PettyCashPayeeType;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  /** null clears it. */
  @ValidateIf((_o, v) => v !== null)
  @Matches(PHONE_PATTERN, { message: 'phone looks invalid' })
  @IsOptional()
  phone?: string | null;

  @ValidateIf((_o, v) => v !== null)
  @trim()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PayeeQueryDto {
  @IsEnum(PettyCashPayeeType)
  @IsOptional()
  type?: PettyCashPayeeType;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

export class UpdateSettingsDto {
  /** Entries strictly above this need admin approval (rupees). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  approvalThreshold?: number;

  /** null removes the school-wide budget. */
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  monthlyBudget?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  receiptRequiredAbove?: number;

  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  overdueDays?: number;

  /** Ask for notes and coins on cash entries and keep the notes in hand. */
  @IsBoolean()
  @IsOptional()
  trackDenominations?: boolean;
}
