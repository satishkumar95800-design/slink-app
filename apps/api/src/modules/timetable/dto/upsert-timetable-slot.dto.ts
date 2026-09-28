import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class UpsertTimetableSlotDto {
  @IsUUID()
  classId: string;

  @IsUUID()
  teacherId: string;

  @IsUUID()
  subjectId: string;

  /** 1 = Monday .. 6 = Saturday. */
  @IsInt()
  @Min(1)
  @Max(6)
  dayOfWeek: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodNumber: number;
}
