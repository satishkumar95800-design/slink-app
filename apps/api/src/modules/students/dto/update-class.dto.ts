import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @IsOptional()
  section?: string;
}
