import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** One subject, taught in several classes at once. */
export class CreateTeacherSubjectsBulkDto {
  @IsUUID()
  subjectId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  classIds: string[];
}
