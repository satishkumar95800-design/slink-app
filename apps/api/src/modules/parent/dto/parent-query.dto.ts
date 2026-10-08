import { IsUUID } from 'class-validator';

export class ParentStudentQueryDto {
  @IsUUID()
  studentId: string;
}
