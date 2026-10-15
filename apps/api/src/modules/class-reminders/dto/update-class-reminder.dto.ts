import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class UpdateClassReminderDto {
  /** Minutes before each class (1–5), or null to switch the reminder off. */
  @ValidateIf((o: UpdateClassReminderDto) => o.minutesBefore !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  minutesBefore: number | null;
}
