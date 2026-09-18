import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class AddClassTeacherDto {
  @IsUUID()
  teacherId: string;

  /** Whether this teacher is the class's homeroom/in-charge teacher. Defaults to true — this endpoint is the "assign class teacher" action. */
  @IsBoolean()
  @IsOptional()
  isClassTeacher?: boolean;
}
