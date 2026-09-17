import { IsArray, ValidateNested, IsUUID, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class CustomFieldValueDto {
  @IsUUID()
  fieldDefinitionId: string;

  @IsString()
  @MaxLength(500)
  value: string;
}

export class SetCustomFieldValuesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomFieldValueDto)
  values: CustomFieldValueDto[];
}
