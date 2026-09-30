import { IsUUID, IsEnum, IsOptional } from 'class-validator';
import { StudentNoteType } from '@prisma/client';

export class StudentNoteQueryDto {
  @IsUUID()
  studentId: string;

  @IsEnum(StudentNoteType)
  @IsOptional()
  type?: StudentNoteType;
}
