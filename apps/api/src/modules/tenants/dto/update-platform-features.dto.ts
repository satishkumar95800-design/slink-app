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
}
