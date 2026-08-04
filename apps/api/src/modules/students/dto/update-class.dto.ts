import { IsString, IsUUID, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  /** UUID of the teacher to assign as class teacher */
  @IsUUID()
  @IsOptional()
  teacherId?: string;
}
