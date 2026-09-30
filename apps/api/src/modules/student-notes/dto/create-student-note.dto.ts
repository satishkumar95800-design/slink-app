import { IsUUID, IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { StudentNoteType } from '@prisma/client';

export class CreateStudentNoteDto {
  @IsUUID()
  studentId: string;

  @IsEnum(StudentNoteType)
  type: StudentNoteType;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}
