import { IsString, IsUUID, IsOptional, MinLength, MaxLength, IsDateString } from 'class-validator';

export class UpdateStudentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsOptional()
  dob?: string;
}
