import { IsString, IsDateString, Matches } from 'class-validator';

export class RolloverArrearsDto {
  /** e.g. "2025-26" — the academic year whose unpaid balances are being carried forward */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'fromAcademicYear must be in format YYYY-YY' })
  fromAcademicYear: string;

  /** e.g. "2026-27" — the new academic year the arrears land on */
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'toAcademicYear must be in format YYYY-YY' })
  toAcademicYear: string;

  /** Due date for the carried-forward "Previous Year Dues" line item */
  @IsDateString()
  dueDate: string;
}
