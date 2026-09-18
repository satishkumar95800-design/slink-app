import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;
}
