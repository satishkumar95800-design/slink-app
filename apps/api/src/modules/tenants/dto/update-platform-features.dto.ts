import { IsBoolean, IsOptional } from 'class-validator';
import { UpdateFeaturesDto } from './update-features.dto';

/** super_admin only: the self-service flags plus per-school modules a school can't switch on itself. */
export class UpdatePlatformFeaturesDto extends UpdateFeaturesDto {
  /** Transfer certificate upload on the student page + "TC missing" report. */
  @IsBoolean()
  @IsOptional()
  transferCertificate?: boolean;

  /** Percentage fee concessions on the student page + today's total on the dashboard. */
  @IsBoolean()
  @IsOptional()
  feeConcession?: boolean;

  /** Premium AI features (docs/SPEC-ai.md): translation, drafts, warnings. */
  @IsBoolean()
  @IsOptional()
  aiInsights?: boolean;

  /** Petty cash ledger, advances, approvals and forecast (admin console; admin + accounts only). */
  @IsBoolean()
  @IsOptional()
  pettyCash?: boolean;

  /** School calendar (holidays, events, PTMs) in the mobile apps and the events section in settings. */
  @IsBoolean()
  @IsOptional()
  calendar?: boolean;

  /** HR & Payroll: employees, staff attendance, leave, payroll (admin console + staff mobile). */
  @IsBoolean()
  @IsOptional()
  hrms?: boolean;

  /** Timetable, bell times, teachers' weekly routine and next-class reminders (Premium). */
  @IsBoolean()
  @IsOptional()
  timetable?: boolean;

  /** Shared staff folders and files (Premium). */
  @IsBoolean()
  @IsOptional()
  staffDocuments?: boolean;

  /** Syllabus topics, target dates and coverage (Premium). */
  @IsBoolean()
  @IsOptional()
  syllabus?: boolean;

  /** Attendance report and fee reports with CSV export (Premium). */
  @IsBoolean()
  @IsOptional()
  advancedReports?: boolean;

  /** The school changing its own logo, background and colours (Premium). */
  @IsBoolean()
  @IsOptional()
  customBranding?: boolean;
}
