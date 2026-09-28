import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateDocumentCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  name?: string;
}
