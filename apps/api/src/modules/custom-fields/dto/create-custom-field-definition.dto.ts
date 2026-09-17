import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  @IsEnum(CustomFieldType)
  fieldType: CustomFieldType;

  /** Choices when fieldType = dropdown */
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
