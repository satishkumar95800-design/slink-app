import { IsUUID } from 'class-validator';

export class AddClassTeacherDto {
  @IsUUID()
  teacherId: string;
}
