import { IsString, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class TenantQueryDto {
  /** Full-text search against name and slug */
  @IsString()
  @IsOptional()
  search?: string;

  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
