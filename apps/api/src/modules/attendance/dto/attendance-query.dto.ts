import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export class RosterQueryDto {
  @IsUUID()
  classId: string;

  /** YYYY-MM-DD; defaults to today in the school's timezone. */
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  @IsOptional()
  date?: string;
}

export class StudentSummaryQueryDto {
  /** YYYY-MM; defaults to the current month in the school's timezone. */
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  @IsOptional()
  month?: string;
}

export class SchoolSummaryQueryDto {
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  @IsOptional()
  date?: string;
}

export class AttendanceReportQueryDto {
  @IsUUID()
  @IsOptional()
  classId?: string;

  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from: string;

  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to: string;

  @IsIn(['json', 'csv'])
  @IsOptional()
  format?: 'json' | 'csv';
}

export class HolidayQueryDto {
  @Matches(DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @Matches(DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  @IsOptional()
  to?: string;
}
