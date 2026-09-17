import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateCustomFieldDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  label?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[];

  @IsBoolean()
  @IsOptional()
  isSensitive?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
