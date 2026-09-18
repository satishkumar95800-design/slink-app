import { IsUUID } from 'class-validator';

export class CreateTeacherSubjectDto {
  @IsUUID()
  subjectId: string;

  @IsUUID()
  classId: string;
}
