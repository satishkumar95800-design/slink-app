import {
  EmploymentType,
  EmployeeStatus,
  LeaveRequestStatus,
  PayRunStatus,
  StaffAttendanceStatus,
  WorkingDaysRule,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
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
  ValidateNested,
} from 'class-validator';
import { CleanName } from '../../../common/decorators/clean-name.decorator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** NUMERIC(12,2) ceiling, kept well inside it. */
export const MAX_AMOUNT = 9_999_999.99;
const PHONE_PATTERN = /^[0-9+\-\s()]{6,20}$/;

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
/** Empty string means "not given" for optional text. */
const blankToUndefined = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  );
const toBool = () =>
  Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );

export const SENSITIVE_FIELDS = [
  'pan',
  'aadhaar',
  'uan',
  'esiNumber',
  'bankAccount',
  'bankIfsc',
  'bankHolder',
] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

// ── employees ───────────────────────────────────────────────────────────────

/** Sensitive text fields shared by create and update. Empty strings are ignored; use clear[] to erase. */
class SensitiveFieldsDto {
  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  pan?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  aadhaar?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  uan?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(20)
  @IsOptional()
  esiNumber?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(30)
  @IsOptional()
  bankAccount?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(15)
  @IsOptional()
  bankIfsc?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  bankHolder?: string;
}

export class CreateEmployeeDto extends SensitiveFieldsDto {
  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @trim()
  @blankToUndefined()
  @Matches(PHONE_PATTERN, { message: 'phone is not valid' })
  @IsOptional()
  phone?: string;

  @trim()
  @blankToUndefined()
  @IsEmail()
  @MaxLength(200)
  @IsOptional()
  email?: string;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  designation: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  department?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @Matches(DATE_PATTERN, { message: 'joinDate must be YYYY-MM-DD' })
  joinDate: string;

  @trim()
  @blankToUndefined()
  @Matches(/^[A-Za-z0-9\-_/]{1,30}$/, { message: 'employeeCode is not valid' })
  @IsOptional()
  employeeCode?: string;

  /** Link to an existing login account (teacher, admin or accounts). */
  @IsUUID()
  @IsOptional()
  userId?: string;
}

export class UpdateEmployeeDto extends SensitiveFieldsDto {
  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  /** Empty string or null clears the value. */
  @trim()
  @Matches(PHONE_PATTERN, { message: 'phone is not valid' })
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsOptional()
  phone?: string | null;

  @trim()
  @IsEmail()
  @MaxLength(200)
  @ValidateIf((_o, v) => v !== null && v !== '')
  @IsOptional()
  email?: string | null;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  designation?: string;

  @trim()
  @IsString()
  @MaxLength(100)
  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  department?: string | null;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @Matches(DATE_PATTERN, { message: 'joinDate must be YYYY-MM-DD' })
  @IsOptional()
  joinDate?: string;

  @trim()
  @Matches(/^[A-Za-z0-9\-_/]{1,30}$/, { message: 'employeeCode is not valid' })
  @IsOptional()
  employeeCode?: string;

  /** null unlinks the login account. */
  @IsUUID()
  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  userId?: string | null;

  /** Sensitive fields to erase. */
  @IsArray()
  @IsIn(SENSITIVE_FIELDS, { each: true })
  @IsOptional()
  clear?: SensitiveField[];
}

export class FromUserDto {
  @IsUUID()
  userId: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  designation?: string;

  @trim()
  @blankToUndefined()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  department?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @Matches(DATE_PATTERN, { message: 'joinDate must be YYYY-MM-DD' })
  @IsOptional()
  joinDate?: string;
}

export class EmployeeQueryDto {
  @trim()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @trim()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  department?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class ExitEmployeeDto {
  @Matches(DATE_PATTERN, { message: 'exitDate must be YYYY-MM-DD' })
  exitDate: string;

  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  reason?: string;
}

export class RevealDto {
  /** Omit to reveal every stored field. */
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(SENSITIVE_FIELDS, { each: true })
  @IsOptional()
  fields?: SensitiveField[];
}

export class ImportQueryDto {
  @toBool()
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean;
}

export class UploadDocumentDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;
}

// ── settings ────────────────────────────────────────────────────────────────

/** Professional tax slab on monthly gross; amounts in rupees. */
export class PtSlabDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  from: number;

  /** Inclusive upper bound; null for the open-ended last slab. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @ValidateIf((_o, v) => v !== null)
  to: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  monthly: number;

  /** Amount for February when it differs. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  february?: number;
}

const percent = { maxDecimalPlaces: 2 };

export class UpdateHrSettingsDto {
  /** 0 = Sunday .. 6 = Saturday. */
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  weeklyOffDays?: number[];

  @IsEnum(WorkingDaysRule)
  @IsOptional()
  workingDaysRule?: WorkingDaysRule;

  @IsBoolean()
  @IsOptional()
  treatUnmarkedAsAbsent?: boolean;

  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  leaveYearStartMonth?: number;

  @IsBoolean()
  @IsOptional()
  pfEnabled?: boolean;

  @IsNumber(percent)
  @Min(0)
  @Max(100)
  @IsOptional()
  pfEmployeeRate?: number;

  @IsNumber(percent)
  @Min(0)
  @Max(100)
  @IsOptional()
  pfEmployerRate?: number;

  /** Rupees. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  pfWageCeiling?: number;

  @IsBoolean()
  @IsOptional()
  esiEnabled?: boolean;

  @IsNumber(percent)
  @Min(0)
  @Max(100)
  @IsOptional()
  esiEmployeeRate?: number;

  @IsNumber(percent)
  @Min(0)
  @Max(100)
  @IsOptional()
  esiEmployerRate?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @IsOptional()
  esiWageCeiling?: number;

  @IsBoolean()
  @IsOptional()
  ptEnabled?: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PtSlabDto)
  @IsOptional()
  ptSlabs?: PtSlabDto[];
}

// ── attendance ──────────────────────────────────────────────────────────────

export class DailyQueryDto {
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date: string;
}

export class AttendanceEntryDto {
  @IsUUID()
  employeeId: string;

  @IsEnum(StaffAttendanceStatus)
  status: StaffAttendanceStatus;

  @trim()
  @IsString()
  @MaxLength(200)
  @IsOptional()
  note?: string;
}

export class SaveDailyDto {
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}

export class MonthQueryDto {
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month: string;

  @IsUUID()
  @IsOptional()
  employeeId?: string;
}

// ── leave ───────────────────────────────────────────────────────────────────

export class CreateLeaveTypeDto {
  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  yearlyAllowance: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  @IsOptional()
  carryForwardCap?: number;

  @IsBoolean()
  isPaid: boolean;
}

export class UpdateLeaveTypeDto {
  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  @IsOptional()
  name?: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  @IsOptional()
  yearlyAllowance?: number;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  @IsOptional()
  carryForwardCap?: number;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class LeaveTypeQueryDto {
  @toBool()
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}

/** Applying for leave from the mobile app: the employee is always the caller's own record. */
export class ApplyLeaveDto {
  @IsUUID()
  leaveTypeId: string;

  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate: string;

  @Matches(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' })
  toDate: string;

  @IsBoolean()
  @IsOptional()
  halfDay?: boolean;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}

/** Console: apply on behalf of an employee (for example ground staff with no login). */
export class CreateLeaveForEmployeeDto extends ApplyLeaveDto {
  @IsUUID()
  employeeId: string;
}

export class LeaveRequestQueryDto {
  @IsEnum(LeaveRequestStatus)
  @IsOptional()
  status?: LeaveRequestStatus;

  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  @IsOptional()
  month?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number;
}

export class LeaveDecisionDto {
  @trim()
  @IsString()
  @MaxLength(300)
  @IsOptional()
  note?: string;
}

export class BalanceQueryDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  /** Any date inside the leave year wanted; defaults to today. */
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  @IsOptional()
  date?: string;
}

// ── payroll ─────────────────────────────────────────────────────────────────

export class ComponentDto {
  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsIn(['EARNING', 'DEDUCTION'])
  kind: 'EARNING' | 'DEDUCTION';

  @IsIn(['FIXED', 'PERCENT_OF_BASIC'])
  calc: 'FIXED' | 'PERCENT_OF_BASIC';

  /** Rupees, for calc = FIXED. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  @ValidateIf((o: ComponentDto) => o.calc === 'FIXED')
  amount?: number;

  /** Percent of basic, for calc = PERCENT_OF_BASIC. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  @ValidateIf((o: ComponentDto) => o.calc === 'PERCENT_OF_BASIC')
  percent?: number;
}

export class CreateStructureDto {
  @IsUUID()
  employeeId: string;

  @Matches(DATE_PATTERN, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom: string;

  /** Rupees. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  basic: number;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  components: ComponentDto[];

  @IsBoolean()
  pfApplicable: boolean;

  @IsBoolean()
  esiApplicable: boolean;

  @IsBoolean()
  ptApplicable: boolean;
}

export class StructureQueryDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;
}

export class GeneratePayRunDto {
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month: string;
}

export class PayRunQueryDto {
  @IsEnum(PayRunStatus)
  @IsOptional()
  status?: PayRunStatus;

  @Matches(/^\d{4}$/, { message: 'year must be YYYY' })
  @IsOptional()
  year?: string;
}

export class AdjustmentDto {
  @IsIn(['ALLOWANCE', 'DEDUCTION'])
  type: 'ALLOWANCE' | 'DEDUCTION';

  @CleanName()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  /** Rupees. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount: number;

  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason: string;
}

export class ReasonDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  reason: string;
}

export class MarkPaidDto {
  @trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference: string;
}
