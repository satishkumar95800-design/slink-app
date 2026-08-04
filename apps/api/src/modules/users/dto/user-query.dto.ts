import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class UserQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}
